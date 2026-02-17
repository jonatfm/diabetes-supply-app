import { HOLIDAY_ITEM_METHODS, holidays, packListForHoliday, packs, packsForHoliday } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";

export function holidayRepo(db: (ExpoSQLiteDatabase<Record<string, unknown>> & {$client: SQLiteDatabase;})) {
  return {
    async getHolidays() {
      return await db.select().from(holidays);
    },

    async getHolidayPackList(holidayId: string) {
      return await db.select().from(packListForHoliday).where(eq(packListForHoliday.holidayId, holidayId));
    },

    async getPacksForHoliday(holidayId: string) {
      return await db.select({
        id: packsForHoliday.id,
        holidayId: packsForHoliday.holidayId,
        packId: packsForHoliday.packId,
        productId: packs.productId,
      }).from(packsForHoliday)
        .leftJoin(packs, eq(packsForHoliday.packId, packs.id))
        .where(eq(packsForHoliday.holidayId, holidayId));
    },

    async getHoliday(id: string) {
      const [holiday] = await db.select().from(holidays).where(eq(holidays.id, id)).limit(1);
      return holiday;
    },

    async createHoliday (
      destination: string,
      durationDays: number,
      products: {
        [productId: string]: {
          amountCalculationType: (typeof HOLIDAY_ITEM_METHODS)[number],
          amountCalculationAttributes: Record<(typeof HOLIDAY_ITEM_METHODS)[number], any>
        }
      }
    ) {
      // Add new holiday
      const [newHoliday] = await db.insert(holidays).values({
        destination,
        durationDays,
        state: "PLANNED",
      }).returning({id: holidays.id});

      // Add products for the holiday to the pack list
      await Promise.all(
        Object.entries(products).map(([productId, { amountCalculationType, amountCalculationAttributes }]) =>
          db.insert(packListForHoliday).values({
            holidayId: newHoliday.id,
            productId,
            amountCalculationType,
            amountCalculationAttributes,
          })
        )
      );

      return newHoliday;
    },

    async addPackToHoliday(holidayId: string, packId: string) {
      await db.insert(packsForHoliday).values({
        holidayId,
        packId,
      });
    }
  }
}