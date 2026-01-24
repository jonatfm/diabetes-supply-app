import { UsualProductsForHoliday } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";

export function holidayRepo(db: (ExpoSQLiteDatabase<Record<string, unknown>> & {$client: SQLiteDatabase;})) {
  return {
    async getUsualProductsForHoliday() {
      return await db.select({
        id: UsualProductsForHoliday.id,
        productId: UsualProductsForHoliday.productId,
      })
      .from(UsualProductsForHoliday);
    },

    async addUsualProductForHoliday(productId: string) {
      const result = await db.insert(UsualProductsForHoliday).values({
        productId,
      }).returning({ id: UsualProductsForHoliday.id });
      return result[0].id;
    },

    async removeUsualProductForHoliday(productId: string) {
      await db.delete(UsualProductsForHoliday).where(
        eq(UsualProductsForHoliday.productId, productId)
      );
    }
  }
}