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
  excludePackIds: string[] = [],
): Promise<HolidayNeedsResult[]> => {
  const packList = await holidayRepo(db).getHolidayPackList(holiday.id);
  const excludeSet = new Set(excludePackIds);
  const results: HolidayNeedsResult[] = [];

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

    // Pick actual packs, earliest expiry first, skipping excluded packs
    const availablePacks = await packsRepo(db).listActiveNonEmptyByProduct(entry.productId);
    const selectedPacks: HolidayNeedsResult["packs"] = [];
    let unitsCollected = 0;

    for (const pack of availablePacks) {
      if (unitsCollected >= calculatedAmount) break;
      if (excludeSet.has(pack.id)) continue;

      const unitsToTake = Math.min(pack.unitsRemaining, calculatedAmount - unitsCollected);
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