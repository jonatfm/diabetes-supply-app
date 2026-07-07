import { HOLIDAY_ITEM_METHODS, holidays, packListForHoliday, packs, packsForHoliday } from "@/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";

/** Holiday states where packed units are still physically committed. */
const ACTIVE_HOLIDAY_STATES = ["PLANNED", "PACKED", "ACTIVE"] as const;
type HolidayState = "PLANNED" | "PACKED" | "ACTIVE" | "COMPLETE";
type HolidayProductPlan = {
  [productId: string]: {
    amountCalculationType: (typeof HOLIDAY_ITEM_METHODS)[number],
    amountCalculationAttributes: Record<string, any>
  }
};

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
        originalUnits: packsForHoliday.originalUnits,
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
      products: HolidayProductPlan,
      /** Pre-computed snapshot amounts keyed by productId. */
      snapshotAmounts: Record<string, number>,
      options?: {
        startDate?: string | null;
        endDate?: string | null;
      },
    ) {
      return await db.transaction(async (tx) => {
        const txDb = tx as unknown as typeof db;
        const [newHoliday] = await txDb.insert(holidays).values({
          destination,
          durationDays,
          startDate: options?.startDate ?? null,
          endDate: options?.endDate ?? null,
          state: "PLANNED",
        }).returning({id: holidays.id});

        for (const [productId, { amountCalculationType, amountCalculationAttributes }] of Object.entries(products)) {
          await txDb.insert(packListForHoliday).values({
            holidayId: newHoliday.id,
            productId,
            amountCalculationType,
            amountCalculationAttributes,
            calculatedAmount: snapshotAmounts[productId] ?? 0,
          });
        }

        return newHoliday;
      });
    },

    async updatePlannedHoliday(
      holidayId: string,
      params: {
        destination: string;
        durationDays: number;
        startDate?: string | null;
        endDate?: string | null;
        products: HolidayProductPlan;
        snapshotAmounts: Record<string, number>;
      },
    ) {
      return await db.transaction(async (tx) => {
        const txDb = tx as unknown as typeof db;
        const [holiday] = await txDb.select().from(holidays).where(eq(holidays.id, holidayId)).limit(1);

        if (!holiday) {
          throw new Error("Trip not found");
        }

        if (holiday.state !== "PLANNED") {
          throw new Error("Only planned trips can be edited. Repack this trip first if you need to change it.");
        }

        await txDb.update(holidays)
          .set({
            destination: params.destination,
            durationDays: params.durationDays,
            startDate: params.startDate ?? null,
            endDate: params.endDate ?? null,
            updatedAt: Date.now(),
          })
          .where(eq(holidays.id, holidayId));

        await txDb.delete(packListForHoliday).where(eq(packListForHoliday.holidayId, holidayId));

        for (const [productId, { amountCalculationType, amountCalculationAttributes }] of Object.entries(params.products)) {
          await txDb.insert(packListForHoliday).values({
            holidayId,
            productId,
            amountCalculationType,
            amountCalculationAttributes,
            calculatedAmount: params.snapshotAmounts[productId] ?? 0,
          });
        }
      });
    },

    /**
     * Record that physical units from a pack have been packed for a holiday.
     *
     * Safety guard: validates that the pack physically has enough unreserved
     * units before inserting. Throws if it would over-commit.
     */
    async addPackToHoliday(holidayId: string, packId: string, units: number) {
      await db.transaction(async (tx) => {
        const txDb = tx as unknown as typeof db;
        const [pack] = await txDb.select().from(packs).where(eq(packs.id, packId));
        if (!pack) throw new Error("Pack not found");

        const existingReservations = await txDb.select({
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
            `(${pack.unitsRemaining} remaining - ${totalReserved} already reserved).`
          );
        }

        const [existingAllocation] = await txDb.select()
          .from(packsForHoliday)
          .where(
            and(
              eq(packsForHoliday.holidayId, holidayId),
              eq(packsForHoliday.packId, packId),
            )
          )
          .limit(1);

        if (existingAllocation) {
          await txDb.update(packsForHoliday)
            .set({
              units: existingAllocation.units + units,
              originalUnits: existingAllocation.originalUnits + units,
            })
            .where(eq(packsForHoliday.id, existingAllocation.id));
          return;
        }

        await txDb.insert(packsForHoliday).values({
          holidayId,
          packId,
          units,
          originalUnits: units,
        });
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
    },

    async updateHolidayState(holidayId: string, state: HolidayState) {
      await db.update(holidays).set({ state, updatedAt: Date.now() }).where(eq(holidays.id, holidayId));
    },

    async getActiveHoliday() {
      const [active] = await db.select().from(holidays).where(eq(holidays.state, "ACTIVE")).limit(1);
      return active ?? null;
    },

    /** Activate a holiday. Throws if another holiday is already active. */
    async activateHoliday(holidayId: string) {
      const existing = await this.getActiveHoliday();
      if (existing && existing.id !== holidayId) {
        throw new Error("Another holiday is already active. End it before activating a new one.");
      }
      await db.update(holidays)
        .set({ state: "ACTIVE", updatedAt: Date.now() })
        .where(eq(holidays.id, holidayId));
    },

    /** End an active holiday and mark it complete. */
    async endHoliday(holidayId: string) {
      await db.update(holidays)
        .set({ state: "COMPLETE", updatedAt: Date.now() })
        .where(eq(holidays.id, holidayId));
    },

    async markReturnHomeReconciled(holidayId: string) {
      await db.update(holidays)
        .set({ returnHomeCompletedAt: Date.now(), updatedAt: Date.now() })
        .where(eq(holidays.id, holidayId));
    },

    async deletePacksForHoliday(holidayId: string) {
      await db.delete(packsForHoliday).where(eq(packsForHoliday.holidayId, holidayId));
    },

    /**
     * Decrement the remaining holiday allocation for a pack by 1.
     * Called when a unit is consumed from a holiday-allocated pack during an
     * active holiday. Returns true if a row was found and decremented.
     */
    async decrementHolidayPackUnit(packId: string): Promise<boolean> {
      const active = await this.getActiveHoliday();
      if (!active) return false;

      // Find allocation row(s) for this pack on the active holiday with remaining units
      const rows = await db.select()
        .from(packsForHoliday)
        .where(
          and(
            eq(packsForHoliday.holidayId, active.id),
            eq(packsForHoliday.packId, packId),
          )
        );

      // Pick the first row that still has units > 0
      const row = rows.find(r => r.units > 0);
      if (!row) return false;

      await db.update(packsForHoliday)
        .set({ units: row.units - 1 })
        .where(eq(packsForHoliday.id, row.id));

      return true;
    },
  }
}
