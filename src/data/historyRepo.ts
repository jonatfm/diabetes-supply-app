import { packs, stock_events } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";

export function historyRepo(db: (ExpoSQLiteDatabase<Record<string, unknown>> & {$client: SQLiteDatabase;})) {
  return {
    async getStockHistoryByProduct(productId: string) {
      return await db.select({
        id: stock_events.id,
        productId: stock_events.productId,
        packId: stock_events.packId,
        type: stock_events.type,
        deltaUnits: stock_events.deltaUnits,
        occuredAt: stock_events.occuredAt,
        createdAt: stock_events.createdAt,
        relatedEventId: stock_events.relatedEventId,
        note: stock_events.note,
        meta: stock_events.meta,
      })
      .from(stock_events)
      .where(
        eq(stock_events.productId, productId)
      )
      .orderBy(desc(stock_events.occuredAt));
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
        .orderBy(desc(stock_events.occuredAt))
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
      
      // Restore the unit to the pack
      const pack = await db.select().from(packs).where(eq(packs.id, eventToUndo.packId));
      return await db.update(packs)
        .set({unitsRemaining: pack[0].unitsRemaining + 1})
        .where(eq(packs.id, eventToUndo.packId));
    },

    async getTakeEventsByProduct(productId: string, periodInDays?: number) {
      let conditions = [
        eq(stock_events.productId, productId),
        eq(stock_events.type, "TAKE")
      ];

      if (periodInDays) {
        const cutoffTime = Date.now() - (periodInDays * 24 * 60 * 60 * 1000);
        conditions.push(gte(stock_events.occuredAt, cutoffTime));
      }

      return await db
        .select({
          id: stock_events.id,
          occuredAt: stock_events.occuredAt,
        })
        .from(stock_events)
        .where(and(...conditions))
        .orderBy(desc(stock_events.occuredAt));
    }
  }
}