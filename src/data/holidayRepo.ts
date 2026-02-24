import { HOLIDAY_ITEM_METHODS, holidays, packListForHoliday, packs, packsForHoliday } from "@/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";

/** Holiday states where packed units are still physically committed. */
const ACTIVE_HOLIDAY_STATES = ["PLANNED", "PACKED", "ACTIVE"] as const;

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
        units: packsForHoliday.units,
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
      },
      /** Pre-computed snapshot amounts keyed by productId. */
      snapshotAmounts: Record<string, number>,
    ) {
      // Add new holiday
      const [newHoliday] = await db.insert(holidays).values({
        destination,
        durationDays,
        state: "PLANNED",
      }).returning({id: holidays.id});

      // Add products for the holiday to the pack list, storing the frozen calculatedAmount
      await Promise.all(
        Object.entries(products).map(([productId, { amountCalculationType, amountCalculationAttributes }]) =>
          db.insert(packListForHoliday).values({
            holidayId: newHoliday.id,
            productId,
            amountCalculationType,
            amountCalculationAttributes,
            calculatedAmount: snapshotAmounts[productId] ?? 0,
          })
        )
      );

      return newHoliday;
    },

    /**
     * Record that physical units from a pack have been packed for a holiday.
     *
     * Safety guard: validates that the pack physically has enough unreserved
     * units before inserting. Throws if it would over-commit.
     */
    async addPackToHoliday(holidayId: string, packId: string, units: number) {
      // Fetch current physical state of the pack
      const [pack] = await db.select().from(packs).where(eq(packs.id, packId));
      if (!pack) throw new Error("Pack not found");

      // Sum units already reserved across ALL active holidays for this specific pack
      const existingReservations = await db.select({
        units: packsForHoliday.units,
      }).from(packsForHoliday)
        .innerJoin(holidays, eq(packsForHoliday.holidayId, holidays.id))
        .where(
          and(
            eq(packsForHoliday.packId, packId),
            inArray(holidays.state, [...ACTIVE_HOLIDAY_STATES]),
          )
        );

      const totalReserved = existingReservations.reduce((sum, r) => sum + r.units, 0);
      const physicallyAvailable = pack.unitsRemaining - totalReserved;

      if (units > physicallyAvailable) {
        throw new Error(
          `Cannot reserve ${units} units from pack ${packId}: only ${physicallyAvailable} physically available ` +
          `(${pack.unitsRemaining} remaining − ${totalReserved} already reserved).`
        );
      }

      await db.insert(packsForHoliday).values({
        holidayId,
        packId,
        units,
      });
    },

    /**
     * Get total reserved units per pack for a given product, across active holidays.
     *
     * @param excludeHolidayId  Optionally exclude one holiday (e.g. the
     *   current one whose own packed items are tracked separately).
     */
    async getHolidayReservedUnitsByPack(
      productId: string,
      excludeHolidayId?: string,
    ): Promise<Record<string, number>> {
      // Build conditions
      const conditions = [
        eq(packs.productId, productId),
        inArray(holidays.state, [...ACTIVE_HOLIDAY_STATES]),
      ];
      if (excludeHolidayId) {
        conditions.push(ne(packsForHoliday.holidayId, excludeHolidayId));
      }

      const results = await db.select({
        packId: packsForHoliday.packId,
        units: packsForHoliday.units,
      }).from(packsForHoliday)
        .innerJoin(packs, eq(packsForHoliday.packId, packs.id))
        .innerJoin(holidays, eq(packsForHoliday.holidayId, holidays.id))
        .where(and(...conditions));

      return results.reduce((acc, row) => {
        acc[row.packId] = (acc[row.packId] || 0) + row.units;
        return acc;
      }, {} as Record<string, number>);
    }
  }
}