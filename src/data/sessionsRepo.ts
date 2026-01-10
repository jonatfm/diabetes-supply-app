import { products, SessionOutcome, sessions } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";

export function sessionsRepo(db: (ExpoSQLiteDatabase<Record<string, unknown>> & {$client: SQLiteDatabase;})) {
  return {
    async startSession(productId: string, packId: string, startedAt: Date) {
      // validate product is session based
      const product = await db.select().from(products).where(eq(products.id, productId));
      if (product.length === 0) {
        throw new Error("Product not found");
      }
      if (product[0].isSessionBased !== 1) {
        throw new Error("Product is not session based");
      }

      // validate no active session exists for this product
      const activeSessions = await db.select().from(sessions).where(
        and(
          eq(sessions.productId, productId),
          isNull(sessions.endedAt)
        )
      )
      if (activeSessions.length > 0) {
        throw new Error("Active session already exists for this product");
      }

      // insert session
      const [session] = await db.insert(sessions).values({
        productId,
        packId,
        startedAt: startedAt.getTime(),
      }).returning({id: sessions.id});
      return session.id;
    },

    async endSession(sessionId: string, endedAt: Date, outcome: SessionOutcome) {
      await db.update(sessions).set({
        endedAt: endedAt.getTime(),
        outcome,
      }).where(eq(sessions.id, sessionId));
    },

    async getActiveSessionByProduct(productId: string) {
      const activeSessions = await db.select().from(sessions).where(
        and(
          eq(sessions.productId, productId),
          isNull(sessions.endedAt)
        )
      );
      return activeSessions.length > 0 ? activeSessions[0] : null;
    },

    async getSessionForPack(packId: string) {
      const sessionForPack = await db.select().from(sessions).where(
        eq(sessions.packId, packId)
      );
      return sessionForPack[0] || null;
    }
  }
}