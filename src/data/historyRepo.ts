import { PacksForHoliday, Session, packs, packsForHoliday, sessions, stock_events } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";
import { holidayRepo } from "./holidayRepo";

function getUndoneEventIds(events: { type: string; relatedEventId: string | null }[]) {
  return new Set(
    events
      .filter((event) => event.type === "UNDO" && event.relatedEventId)
      .map((event) => event.relatedEventId as string)
  );
}

export function historyRepo(db: (ExpoSQLiteDatabase<Record<string, unknown>> & {$client: SQLiteDatabase;})) {
  return {
    async getStockHistoryByProduct(productId: string) {
      return await db.select({
        id: stock_events.id,
        productId: stock_events.productId,
        packId: stock_events.packId,
        type: stock_events.type,
        deltaUnits: stock_events.deltaUnits,
        occurredAt: stock_events.occurredAt,
        createdAt: stock_events.createdAt,
        relatedEventId: stock_events.relatedEventId,
        relatedSessionId: stock_events.relatedSessionId,
        note: stock_events.note,
        meta: stock_events.meta,
      })
      .from(stock_events)
      .where(
        eq(stock_events.productId, productId)
      )
      .orderBy(desc(stock_events.occurredAt));
    },

    async undoLastTakeActionFromProduct(productId: string) {
      await db.transaction(async (tx) => {
        const txDb = tx as unknown as typeof db;
        const events = await txDb
          .select()
          .from(stock_events)
          .where(eq(stock_events.productId, productId))
          .orderBy(desc(stock_events.occurredAt));

        const undoneEventIds = getUndoneEventIds(events);
        const eventToUndo = events.find(
          (event) => event.type === "TAKE" && !undoneEventIds.has(event.id)
        );

        if (!eventToUndo) {
          throw new Error("No TAKE event found for this product");
        }

        if (!eventToUndo.packId) {
          throw new Error("Cannot undo TAKE event without associated pack");
        }

        const [pack] = await txDb.select().from(packs).where(eq(packs.id, eventToUndo.packId));
        if (!pack) {
          throw new Error("Pack not found");
        }

        const now = Date.now();
        let sessionBefore: Session | null = null;
        if (eventToUndo.relatedSessionId) {
          const [session] = await txDb
            .select()
            .from(sessions)
            .where(eq(sessions.id, eventToUndo.relatedSessionId));

          if (session) {
            sessionBefore = session;
            await txDb
              .update(sessions)
              .set({
                endedAt: session.endedAt ?? now,
                outcome: session.outcome ?? "unknown",
                reason: session.reason ?? "undone",
                meta: {
                  ...(session.meta ?? {}),
                  undone: true,
                  undoneAt: now,
                  undoneStockEventId: eventToUndo.id,
                },
              })
              .where(eq(sessions.id, session.id));
          }
        }

        const beforeUnits = pack.unitsRemaining;
        await txDb.update(packs)
          .set({unitsRemaining: beforeUnits + 1})
          .where(eq(packs.id, eventToUndo.packId));

        let holidayAllocationBefore: PacksForHoliday | null = null;
        let holidayAllocationAfter: PacksForHoliday | null = null;

        // If there is an active holiday with this pack allocated, re-increment
        // the holiday allocation to reverse the decrement done during consume.
        const active = await holidayRepo(txDb).getActiveHoliday();
        if (active) {
          const rows = await txDb.select()
            .from(packsForHoliday)
            .where(
              and(
                eq(packsForHoliday.holidayId, active.id),
                eq(packsForHoliday.packId, eventToUndo.packId),
              )
            );
          const row = rows.find(r => r.units < r.originalUnits);
          if (row) {
            holidayAllocationBefore = row;
            await txDb.update(packsForHoliday)
              .set({ units: row.units + 1 })
              .where(eq(packsForHoliday.id, row.id));
            holidayAllocationAfter = { ...row, units: row.units + 1 };
          }
        }

        await txDb.insert(stock_events).values({
          productId,
          packId: eventToUndo.packId,
          type: "UNDO",
          deltaUnits: 1,
          occurredAt: now,
          createdAt: now,
          relatedEventId: eventToUndo.id,
          relatedSessionId: eventToUndo.relatedSessionId,
          note: "Undo take via app",
          meta: {
            action: "undo_take",
            originalEvent: eventToUndo,
            pack: {
              before: {
                unitsRemaining: beforeUnits,
              },
              after: {
                unitsRemaining: beforeUnits + 1,
              },
            },
            session: sessionBefore
              ? {
                before: sessionBefore,
                after: {
                  ...sessionBefore,
                  endedAt: sessionBefore.endedAt ?? now,
                  outcome: sessionBefore.outcome ?? "unknown",
                  reason: sessionBefore.reason ?? "undone",
                  meta: {
                    ...(sessionBefore.meta ?? {}),
                    undone: true,
                    undoneAt: now,
                    undoneStockEventId: eventToUndo.id,
                  },
                },
              }
              : null,
            holidayAllocation: holidayAllocationBefore
              ? {
                before: holidayAllocationBefore,
                after: holidayAllocationAfter,
              }
              : null,
          },
        });
      });
    },

    async getTakeEventsByProduct(productId: string, periodInDays?: number) {
      const events = await db
        .select({
          id: stock_events.id,
          occurredAt: stock_events.occurredAt,
          type: stock_events.type,
          relatedEventId: stock_events.relatedEventId,
        })
        .from(stock_events)
        .where(eq(stock_events.productId, productId))
        .orderBy(desc(stock_events.occurredAt));

      const undoneEventIds = getUndoneEventIds(events);
      return events
        .filter((event) => event.type === "TAKE" && !undoneEventIds.has(event.id))
        .filter((event) => !periodInDays || event.occurredAt >= Date.now() - (periodInDays * 24 * 60 * 60 * 1000))
        .map(({ id, occurredAt }) => ({ id, occurredAt }));
    },

    async getSessionsByProduct(productId: string, periodInDays?: number) {
      let conditions = [eq(sessions.productId, productId)];

      if (periodInDays) {
        const cutoffTime = Date.now() - (periodInDays * 24 * 60 * 60 * 1000);
        conditions.push(gte(sessions.startedAt, cutoffTime));
      }

      return await db
        .select({
          id: sessions.id,
          startedAt: sessions.startedAt,
          endedAt: sessions.endedAt,
          outcome: sessions.outcome,
        })
        .from(sessions)
        .where(and(...conditions))
        .orderBy(desc(sessions.startedAt));
    }
  }
}
