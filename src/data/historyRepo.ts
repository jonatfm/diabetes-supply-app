import { packs, packsForHoliday, sessions, stock_events } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";
import { holidayRepo } from "./holidayRepo";

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
      const lastTakeEvent = await db
        .select()
        .from(stock_events)
        .where(
          and(
            eq(stock_events.productId, productId),
            eq(stock_events.type, "TAKE")
          )
        )
        .orderBy(desc(stock_events.occurredAt))
        .limit(1);

      if (lastTakeEvent.length === 0) {
        throw new Error("No TAKE event found for this product");
      }
      
      const eventToUndo = lastTakeEvent[0];
      if (!eventToUndo.packId) {
        throw new Error("Cannot undo TAKE event without associated pack");
      }

      // Remove the stock event
      await db
        .delete(stock_events)
        .where(eq(stock_events.id, eventToUndo.id));
      
      // Check if there is an associated session and delete it. Reopen the last session by deleting the endedAt and outcome.
      if (eventToUndo.relatedSessionId) {
        await db.delete(sessions).where(eq(sessions.id, eventToUndo.relatedSessionId));
      }

      // Restore the unit to the pack
      const pack = await db.select().from(packs).where(eq(packs.id, eventToUndo.packId));
      await db.update(packs)
        .set({unitsRemaining: pack[0].unitsRemaining + 1})
        .where(eq(packs.id, eventToUndo.packId));

      // If there is an active holiday with this pack allocated, re-increment
      // the holiday allocation to reverse the decrement done during consume.
      const active = await holidayRepo(db).getActiveHoliday();
      if (active) {
        const rows = await db.select()
          .from(packsForHoliday)
          .where(
            and(
              eq(packsForHoliday.holidayId, active.id),
              eq(packsForHoliday.packId, eventToUndo.packId),
            )
          );
        const row = rows.find(r => r.units < r.originalUnits);
        if (row) {
          await db.update(packsForHoliday)
            .set({ units: row.units + 1 })
            .where(eq(packsForHoliday.id, row.id));
        }
      }
    },

    async getTakeEventsByProduct(productId: string, periodInDays?: number) {
      let conditions = [
        eq(stock_events.productId, productId),
        eq(stock_events.type, "TAKE")
      ];

      if (periodInDays) {
        const cutoffTime = Date.now() - (periodInDays * 24 * 60 * 60 * 1000);
        conditions.push(gte(stock_events.occurredAt, cutoffTime));
      }

      return await db
        .select({
          id: stock_events.id,
          occurredAt: stock_events.occurredAt,
        })
        .from(stock_events)
        .where(and(...conditions))
        .orderBy(desc(stock_events.occurredAt));
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