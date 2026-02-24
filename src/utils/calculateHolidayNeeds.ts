import { db } from "@/db";
import { Holiday, Product } from "@/db/schema";
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

export const calculateHolidayNeedsSimple = async (holiday: Holiday): Promise<HolidayNeedsSimpleResult[]> => {
  const packList = await holidayRepo(db).getHolidayPackList(holiday.id);
  const results: HolidayNeedsSimpleResult[] = [];

  for (const entry of packList) {
    const product = await productRepo(db).getProductById(entry.productId);
    if (!product) return [];
    const attrs = entry.amountCalculationAttributes as Record<string, any>;
    let calculatedAmount = 0;

    switch (entry.amountCalculationType) {
      case "AVERAGE_PLUS_PERCENTAGE_BUFFER": {
        const avgDaysPerItem = await statisticsRepo(db).getAverageDurationPerItem(entry.productId);
        if (avgDaysPerItem && avgDaysPerItem > 0) {
          const baseAmount = holiday.durationDays / avgDaysPerItem;
          const percentageBuffer = attrs.percentageBuffer ?? 20;
          calculatedAmount = Math.ceil(baseAmount * (1 + percentageBuffer / 100));
        }
        break;
      }

      case "AVERAGE_PLUS_FIXED_BUFFER": {
        const avgDaysPerItem = await statisticsRepo(db).getAverageDurationPerItem(entry.productId);
        if (avgDaysPerItem && avgDaysPerItem > 0) {
          const baseAmount = holiday.durationDays / avgDaysPerItem;
          const fixedBuffer = attrs.fixedBuffer ?? 2;
          calculatedAmount = Math.ceil(baseAmount) + fixedBuffer;
        }
        break;
      }

      case "FIXED_AMOUNT": {
        const fixedAmount = attrs.fixedAmount ?? 0;
        calculatedAmount = fixedAmount;
        break;
      }

      case "PER_DAY": {
        const perDayAmount = attrs.perDayAmount ?? 0;
        calculatedAmount = Math.ceil(perDayAmount * holiday.durationDays);
        break;
      }

      case "PER_DAY_PLUS_BUFFER_DAYS": {
        const perDayAmount = attrs.perDayAmount ?? 0;
        const bufferDays = attrs.bufferDays ?? 5;
        calculatedAmount = Math.ceil(perDayAmount * (holiday.durationDays + bufferDays));
        break;
      }
    }

    results.push({
      calculatedAmount,
      method: entry.amountCalculationType,
      product: product,
    });
  }

  return results;
}

export const calculateHolidayNeeds = async (
  holiday: Holiday,
): Promise<HolidayNeedsResult[]> => {
  const packList = await holidayRepo(db).getHolidayPackList(holiday.id);
  const packedForHoliday = await holidayRepo(db).getPacksForHoliday(holiday.id);
  const results: HolidayNeedsResult[] = [];

  // Sum already-packed units per product from persisted records
  const packedUnitsByProduct = packedForHoliday.reduce((acc, packed) => {
    if (!packed.productId) return acc;
    acc[packed.productId] = (acc[packed.productId] || 0) + packed.units;
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
    const attrs = entry.amountCalculationAttributes as Record<string, any>;
    let calculatedAmount = 0;

    switch (entry.amountCalculationType) {
      case "AVERAGE_PLUS_PERCENTAGE_BUFFER": {
        const avgDaysPerItem = await statisticsRepo(db).getAverageDurationPerItem(entry.productId);
        if (avgDaysPerItem && avgDaysPerItem > 0) {
          const baseAmount = holiday.durationDays / avgDaysPerItem;
          const percentageBuffer = attrs.percentageBuffer ?? 20;
          calculatedAmount = Math.ceil(baseAmount * (1 + percentageBuffer / 100));
        }
        break;
      }

      case "AVERAGE_PLUS_FIXED_BUFFER": {
        const avgDaysPerItem = await statisticsRepo(db).getAverageDurationPerItem(entry.productId);
        if (avgDaysPerItem && avgDaysPerItem > 0) {
          const baseAmount = holiday.durationDays / avgDaysPerItem;
          const fixedBuffer = attrs.fixedBuffer ?? 2;
          calculatedAmount = Math.ceil(baseAmount) + fixedBuffer;
        }
        break;
      }

      case "FIXED_AMOUNT": {
        const fixedAmount = attrs.fixedAmount ?? 0;
        calculatedAmount = fixedAmount;
        break;
      }

      case "PER_DAY": {
        const perDayAmount = attrs.perDayAmount ?? 0;
        calculatedAmount = Math.ceil(perDayAmount * holiday.durationDays);
        break;
      }

      case "PER_DAY_PLUS_BUFFER_DAYS": {
        const perDayAmount = attrs.perDayAmount ?? 0;
        const bufferDays = attrs.bufferDays ?? 5;
        calculatedAmount = Math.ceil(perDayAmount * (holiday.durationDays + bufferDays));
        break;
      }
    }

    const alreadyPacked = packedUnitsByProduct[entry.productId] ?? 0;
    const remainingAmount = Math.max(calculatedAmount - alreadyPacked, 0);
    const packedSet = packedPackIdsByProduct[entry.productId] ?? new Set<string>();

    // Pick next packs for remaining units, earliest expiry first, skipping already-packed packs
    const availablePacks = await packsRepo(db).listActiveNonEmptyByProduct(entry.productId);
    const selectedPacks: HolidayNeedsResult["packs"] = [];
    let unitsCollected = 0;

    for (const pack of availablePacks) {
      if (unitsCollected >= remainingAmount) break;
      if (packedSet.has(pack.id)) continue;

      const unitsToTake = Math.min(pack.unitsRemaining, remainingAmount - unitsCollected);
      if (unitsToTake <= 0) continue;
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