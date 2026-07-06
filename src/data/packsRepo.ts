import { Pack, packs, products, stock_events } from "@/db/schema";
import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";
import { appSettingsRepo } from "./appSettingsRepo";
import { coloredDotsRepo } from "./coloredDotsRepo";
import { holidayRepo } from "./holidayRepo";
import { sessionsRepo } from "./sessionsRepo";

export type ChangesFormat = {
  [packId: string]: {
    unitsRemaining: number | null;
    expiry: string | null;
  };
}


export function packsRepo(db: (ExpoSQLiteDatabase<Record<string, unknown>> & {$client: SQLiteDatabase;})) {
  return {
    async listActiveNonEmptyByProduct(productId: string): Promise<Pack[]> {
      const result = await db
        .select()
        .from(packs)
        .where(and(eq(packs.productId, productId), ne(packs.unitsRemaining, 0), eq(packs.active, true)));

      return result.sort((a: any, b: any) => {
        const aExpiry = a.expiry ? new Date(a.expiry).getTime() : Infinity;
        const bExpiry = b.expiry ? new Date(b.expiry).getTime() : Infinity;
        if (aExpiry !== bExpiry) return aExpiry - bExpiry;
        return a.createdAt - b.createdAt;
      });
    },

    async totalUnitsByProduct(productId: string) {
      const res = await db
        .select({ total: sql<number>`cast(sum(${packs.unitsRemaining}) as int)` })
        .from(packs)
        .where(and(eq(packs.productId, productId), eq(packs.active, true)));
      return res[0]?.total ?? 0;
    },

    async discardExpiredByProduct(productId: string, nowIso = new Date().toISOString()) {
      await db.transaction(async (tx) => {
        const txDb = tx as unknown as typeof db;
        const expiredPacks = await txDb
          .select()
          .from(packs)
          .where(and(
            eq(packs.productId, productId),
            eq(packs.active, true),
            gt(packs.unitsRemaining, 0),
            lt(packs.expiry, nowIso),
          ));

        for (const pack of expiredPacks) {
          const now = Date.now();
          await txDb
            .update(packs)
            .set({
              active: false,
              unitsRemaining: 0,
            })
            .where(eq(packs.id, pack.id));

          await txDb.insert(stock_events).values({
            productId,
            packId: pack.id,
            type: "DISCARD",
            deltaUnits: -pack.unitsRemaining,
            occurredAt: now,
            createdAt: now,
            note: "Expired pack discarded via app",
            meta: {
              reason: "expired",
              before: {
                unitsRemaining: pack.unitsRemaining,
                expiry: pack.expiry,
                active: pack.active,
              },
              after: {
                unitsRemaining: 0,
                expiry: pack.expiry,
                active: false,
              },
            },
          });
        }
      });
    },

    async addPackWithStockEvent(params: {
      productId: string;
      expiry?: string;
      productionDate?: string;
      units: number;
      ais?: Record<string, string> | null;
      note?: string;
      timestamp?: number;
      dateSetManually?: boolean;
      coloredDotIds?: string[];
      rawCode: string;
    }) {
      return await db.transaction(async (tx) => {
        const txDb = tx as unknown as typeof db;
        const now = params.timestamp ?? Date.now();
        const [pack] = await txDb.insert(packs).values({
          productId: params.productId,
          expiry: params.expiry,
          productionDate: params.productionDate,
          createdAt: now,
          unitsRemaining: params.units,
          ais: params.ais ?? null,
          dateSetManually: params.dateSetManually,
          rawCode: params.rawCode,
        }).returning({ id: packs.id });

        await txDb.insert(stock_events).values({
          productId: params.productId,
          packId: pack.id,
          type: "ADD",
          deltaUnits: params.units,
          occurredAt: now,
          createdAt: now,
          note: params.note ?? "Via app",
        });

        // Use provided colored dot IDs if available, otherwise generate new ones.
        if (params.coloredDotIds && params.coloredDotIds.length > 0) {
          const dotsRepo = coloredDotsRepo(txDb);
          await dotsRepo.setAssignmentForPack(pack.id, params.coloredDotIds);
        } else {
          const dotsEnabled = await appSettingsRepo(txDb).getByKey<boolean>("coloredDotsEnabled");
          const product = await txDb.select().from(products).where(eq(products.id, params.productId)).limit(1);
          if (dotsEnabled && product.length > 0 && product[0].useColoredDots) {
            const dotsRepo = coloredDotsRepo(txDb);
            const combo = await dotsRepo.generateUniqueCombinationForProduct(params.productId);
            if (combo && combo.length > 0) {
              await dotsRepo.setAssignmentForPack(pack.id, combo);
            }
          }
        }


        return pack.id;
      });
    },

    async findDuplicatePackByAis(productId: string, ais: Record<string, string>) {
      const aisString = JSON.stringify(ais);
      const existingPacks = await db.select().from(packs).where(eq(packs.productId, productId));

      return existingPacks.find((pack) => {
        if (!pack.ais) return false;
        try {
          return JSON.stringify(pack.ais) === aisString;
        } catch {
          return false;
        }
      }) ?? null;
    },

    async consumeOneUnit(productId: string, packId: string) {
      await db.transaction(async (tx) => {
        const txDb = tx as unknown as typeof db;
        const [p] = await txDb.select().from(packs).where(eq(packs.id, packId));
        if (!p) throw new Error("Pack not found");
        if (p.unitsRemaining <= 0) throw new Error("No units left");

        // Check if product is session based
        const product = await txDb.select().from(products).where(eq(products.id, productId)).limit(1);
        if (product.length === 0) throw new Error("Product not found");

        let relatedSessionId: string | null = null;
        if (product[0].isSessionBased) {
          // Create a new session
          relatedSessionId = await sessionsRepo(txDb).startSession(productId, packId, new Date());
        }

        const updatedPacks = await txDb
          .update(packs)
          .set({ unitsRemaining: p.unitsRemaining - 1 })
          .where(and(eq(packs.id, packId), gt(packs.unitsRemaining, 0)))
          .returning({ id: packs.id });

        if (updatedPacks.length === 0) {
          throw new Error("No units left");
        }

        const now = Date.now();
        await txDb.insert(stock_events).values({
          productId,
          packId,
          type: "TAKE",
          deltaUnits: -1,
          occurredAt: now,
          createdAt: now,
          note: "Via app",
          relatedSessionId,
        });

        // If there is an active holiday with this pack allocated, decrement the
        // holiday allocation so the remaining count stays accurate.
        await holidayRepo(txDb).decrementHolidayPackUnit(packId);
      });
    },

    async manualDataUpdate(changes: ChangesFormat) {
      // Manually apply changes to packs
      for (const packId in changes) {
        const change = changes[packId];
        
        // Get the pack's productId, current unitsRemaining, expiry and active before updating
        const [pack] = await db.select({ productId: packs.productId, unitsRemaining: packs.unitsRemaining, expiry: packs.expiry, active: packs.active }).from(packs).where(eq(packs.id, packId));
        if (!pack) throw new Error("Pack not found");

        // Calculate deltaUnits only when unitsRemaining is provided in the change
        const oldUnits = typeof pack.unitsRemaining === "number" ? pack.unitsRemaining : 0;
        const unitsProvided = change.unitsRemaining !== null;
        const newUnits = unitsProvided ? change.unitsRemaining as number : oldUnits;
        const deltaUnits = unitsProvided ? (newUnits - oldUnits) : 0;

        // Build a meta object describing before/after for traceability
        const metaObj = {
          change,
          before: {
            unitsRemaining: oldUnits,
            expiry: pack.expiry ?? null,
            active: typeof pack.active === 'number' ? pack.active : 1,
          },
          after: {
            unitsRemaining: unitsProvided ? newUnits : oldUnits,
            expiry: change.expiry !== null ? change.expiry : (pack.expiry ?? null),
            active: unitsProvided && newUnits === 0 ? 0 : (typeof pack.active === 'number' ? pack.active : 1),
          },
        } as Record<string, any>;

        await db.update(packs).set({
          unitsRemaining: unitsProvided ? newUnits : undefined,
          expiry: change.expiry !== null ? change.expiry : undefined,
          active: unitsProvided && newUnits === 0 ? false : undefined,
        }).where(eq(packs.id, packId));

        // Insert a stock event to track the adjustment (include deltaUnits)
        await db.insert(stock_events).values({
          productId: pack.productId,
          packId: packId,
          type: "ADJUST",
          deltaUnits: deltaUnits,
          meta: metaObj,
          occurredAt: Date.now(),
          createdAt: Date.now(),
          note: "Manual adjustment via app",
        });
      }
    },

    async fetchPackById(packId: string): Promise<Pack | null> {
      const packsFound = await db.select().from(packs).where(eq(packs.id, packId));
      return packsFound.length > 0 ? packsFound[0] : null;
    },

    async findMatchingPacks(productId: string, rawCode?: string, ais?: Record<string, string>): Promise<Pack[] | null> {
      // First, check if the "rawCode" field exists and rawCode parameter is provided
      if (rawCode) {
        const packsByRawCode = await db.select().from(packs).where(and(eq(packs.productId, productId), eq(packs.rawCode, rawCode)));
        if (packsByRawCode.length > 0) {
          console.log("found by raw code")
          return packsByRawCode;
        }
      }

      if (ais) {
        // Next, if ais are provided, try to match by AIs fields (legacy method)
        const existingPacks = await db.select().from(packs).where(eq(packs.productId, productId));
        // Sort keys to ensure consistent comparison regardless of order
        const normalize = (obj: Record<string, string>) =>
        JSON.stringify(
          Object.keys(obj)
          .sort()
          .reduce((acc, key) => {
            acc[key] = obj[key];
            return acc;
          }, {} as Record<string, string>)
        );

        const normalizedAis = normalize(ais);
        let matches: Pack[] = [];

        for (const pack of existingPacks) {
          if (!pack.ais) continue;
          try {
            if (normalize(pack.ais as Record<string, string>) === normalizedAis) {
              matches.push(pack);
            }
          } catch {
            // skip malformed ais
          }
        }

        if (matches.length > 0) {
          return matches;
        }
      }

      return null;
    }
  };
}
