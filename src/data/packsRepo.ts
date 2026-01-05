import { Pack, packs, stock_events } from "@/db/schema";
import { and, eq, lt, ne, sql } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";

export function packsRepo(db: (ExpoSQLiteDatabase<Record<string, unknown>> & {$client: SQLiteDatabase;})) {
  return {
    async listActiveNonEmptyByProduct(productId: string): Promise<Pack[]> {
      const result = await db
        .select()
        .from(packs)
        .where(and(eq(packs.productId, productId), ne(packs.unitsRemaining, 0), eq(packs.active, 1)));

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
        .where(and(eq(packs.productId, productId), eq(packs.active, 1)));
      return res[0]?.total ?? 0;
    },

    async discardExpiredByProduct(productId: string, nowIso = new Date().toISOString()) {
      await db
        .update(packs)
        .set({ active: 0 })
        .where(and(eq(packs.productId, productId), lt(packs.expiry, nowIso)));
    },

    async addPackWithStockEvent(params: {
      productId: string;
      expiry?: string;
      productionDate?: string;
      units: number;
      ais?: Record<string, string> | null;
      note?: string;
      timestamp?: number;
    }) {
      const now = params.timestamp ?? Date.now();
      const [pack] = await db.insert(packs).values({
        productId: params.productId,
        expiry: params.expiry,
        productionDate: params.productionDate,
        createdAt: now,
        unitsRemaining: params.units,
        ais: params.ais ?? null,
      }).returning({ id: packs.id });

      await db.insert(stock_events).values({
        productId: params.productId,
        packId: pack.id,
        type: "ADD",
        deltaUnits: params.units,
        occuredAt: now,
        createdAt: now,
        note: params.note ?? "Via app",
      });

      return pack.id;
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
      const [p] = await db.select().from(packs).where(eq(packs.id, packId));
      if (!p) throw new Error("Pack not found");
      if (p.unitsRemaining <= 0) throw new Error("No units left");

      await db.update(packs).set({ unitsRemaining: p.unitsRemaining - 1 }).where(eq(packs.id, packId));

      await db.insert(stock_events).values({
        productId,
        packId,
        type: "TAKE",
        deltaUnits: -1,
        occuredAt: Date.now(),
        createdAt: Date.now(),
        note: "Via app",
      });
    },
  };
}