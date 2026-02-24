import { db } from "@/db";
import { Holiday, HOLIDAY_ITEM_METHODS, Product } from "@/db/schema";
import { holidayRepo } from "../data/holidayRepo";
import { packsRepo } from "../data/packsRepo";
import { productRepo } from "../data/productRepo";
import { statisticsRepo } from "../data/statisticsRepo";

export interface HolidayNeedsSimpleResult {
  calculatedAmount: number;
  method: string;
  product: Product;
}

export interface HolidayNeedsResult {
  calculatedAmount: number;
  method: string;
  product: Product;
  packs: {
    packId: string;
    units: number;
  }[];
}

// ---------------------------------------------------------------------------
// Pure helper – computes the amount for a single product+method.
// Used both to snapshot at holiday-creation time and as a fallback for legacy
// rows that have no stored calculatedAmount.
// ---------------------------------------------------------------------------
export const computeAmountForMethod = async (
  productId: string,
  durationDays: number,
  method: (typeof HOLIDAY_ITEM_METHODS)[number],
  attrs: Record<string, any>,
): Promise<number> => {
  switch (method) {
    case "AVERAGE_PLUS_PERCENTAGE_BUFFER": {
      const avgDaysPerItem = await statisticsRepo(db).getAverageDurationPerItem(productId);
      if (avgDaysPerItem && avgDaysPerItem > 0) {
        const baseAmount = durationDays / avgDaysPerItem;
        const percentageBuffer = attrs.percentageBuffer ?? 20;
        return Math.ceil(baseAmount * (1 + percentageBuffer / 100));
      }
      return 0;
    }

    case "AVERAGE_PLUS_FIXED_BUFFER": {
      const avgDaysPerItem = await statisticsRepo(db).getAverageDurationPerItem(productId);
      if (avgDaysPerItem && avgDaysPerItem > 0) {
        const baseAmount = durationDays / avgDaysPerItem;
        const fixedBuffer = attrs.fixedBuffer ?? 2;
        return Math.ceil(baseAmount) + fixedBuffer;
      }
      return 0;
    }

    case "FIXED_AMOUNT":
      return attrs.fixedAmount ?? 0;

    case "PER_DAY":
      return Math.ceil((attrs.perDayAmount ?? 0) * durationDays);

    case "PER_DAY_PLUS_BUFFER_DAYS": {
      const perDayAmount = attrs.perDayAmount ?? 0;
      const bufferDays = attrs.bufferDays ?? 5;
      return Math.ceil(perDayAmount * (durationDays + bufferDays));
    }

    default:
      return 0;
  }
};

// ---------------------------------------------------------------------------
// Simple version – returns the target amount per product (no pack selection).
// Uses the stored snapshot; falls back to live calculation only for legacy
// rows where calculatedAmount is null.
// ---------------------------------------------------------------------------
export const calculateHolidayNeedsSimple = async (holiday: Holiday): Promise<HolidayNeedsSimpleResult[]> => {
  const packList = await holidayRepo(db).getHolidayPackList(holiday.id);
  const results: HolidayNeedsSimpleResult[] = [];

  for (const entry of packList) {
    const product = await productRepo(db).getProductById(entry.productId);
    if (!product) return [];

    // Prefer the frozen snapshot; recalculate only for legacy rows without one
    const calculatedAmount = entry.calculatedAmount ??
      await computeAmountForMethod(
        entry.productId,
        holiday.durationDays,
        entry.amountCalculationType,
        entry.amountCalculationAttributes as Record<string, any>,
      );

    results.push({
      calculatedAmount,
      method: entry.amountCalculationType,
      product,
    });
  }

  return results;
};

// ---------------------------------------------------------------------------
// Full version – returns the target amount AND the next packs to take.
//
// Safety invariants:
//   1. The target amount is a frozen snapshot (never drifts with usage stats).
//   2. Already-packed packs (for THIS holiday) are skipped.
//   3. Units reserved by OTHER holidays are subtracted from each pack's
//      available balance so two holidays can never claim the same physical
//      unit.
// ---------------------------------------------------------------------------
export const calculateHolidayNeeds = async (
  holiday: Holiday,
): Promise<HolidayNeedsResult[]> => {
  const packList = await holidayRepo(db).getHolidayPackList(holiday.id);
  const packedForHoliday = await holidayRepo(db).getPacksForHoliday(holiday.id);
  const results: HolidayNeedsResult[] = [];

  // Sum already-packed units per product from persisted records
  const packedUnitsByProduct = packedForHoliday.reduce((acc, packed) => {
    if (!packed.productId) return acc;
    acc[packed.productId] = (acc[packed.productId] || 0) + packed.originalUnits;
    return acc;
  }, {} as Record<string, number>);

  // Collect already-packed packIds per product so we skip them when recommending next packs
  const packedPackIdsByProduct = packedForHoliday.reduce((acc, packed) => {
    if (!packed.productId) return acc;
    if (!acc[packed.productId]) acc[packed.productId] = new Set<string>();
    acc[packed.productId].add(packed.packId);
    return acc;
  }, {} as Record<string, Set<string>>);

  for (const entry of packList) {
    const product = await productRepo(db).getProductById(entry.productId);
    if (!product) return [];

    // ---- frozen target amount (Flaw 1 fix) ----
    const calculatedAmount = entry.calculatedAmount ??
      await computeAmountForMethod(
        entry.productId,
        holiday.durationDays,
        entry.amountCalculationType,
        entry.amountCalculationAttributes as Record<string, any>,
      );

    const alreadyPacked = packedUnitsByProduct[entry.productId] ?? 0;
    const remainingAmount = Math.max(calculatedAmount - alreadyPacked, 0);
    const packedSet = packedPackIdsByProduct[entry.productId] ?? new Set<string>();

    // ---- cross-holiday reservation awareness (Flaw 2 fix) ----
    // Get units reserved by ALL active holidays for this product so we never
    // double-book the same physical units.
    const allReservedByPack = await holidayRepo(db).getHolidayReservedUnitsByPack(
      entry.productId,
      holiday.id, // exclude current holiday — its reservations are handled via packedSet
    );

    // Pick next packs for remaining units, earliest expiry first
    const availablePacks = await packsRepo(db).listActiveNonEmptyByProduct(entry.productId);
    const selectedPacks: HolidayNeedsResult["packs"] = [];
    let unitsCollected = 0;

    for (const pack of availablePacks) {
      if (unitsCollected >= remainingAmount) break;
      if (packedSet.has(pack.id)) continue;

      // Physical units truly available = unitsRemaining − units claimed by other holidays
      const reservedByOthers = allReservedByPack[pack.id] ?? 0;
      const physicallyAvailable = pack.unitsRemaining - reservedByOthers;
      if (physicallyAvailable <= 0) continue;

      const unitsToTake = Math.min(physicallyAvailable, remainingAmount - unitsCollected);
      selectedPacks.push({ packId: pack.id, units: unitsToTake });
      unitsCollected += unitsToTake;
    }

    results.push({
      calculatedAmount,
      method: entry.amountCalculationType,
      product,
      packs: selectedPacks,
    });
  }

  return results;
}