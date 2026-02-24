import { Holiday } from "@/db/schema";
import { useMemo } from "react";
import { useActiveHoliday } from "./useActiveHoliday";
import { useGetPacksForHoliday } from "./useGetPacksForHoliday";
import { usePackListForHoliday } from "./usePackListForHoliday";

export type HolidayProductInfo = {
  isOnHoliday: boolean;
  hasActiveHoliday: boolean;
  isLoading: boolean;
  activeHolidayId: string | undefined;
  activeHoliday: Holiday | null;
  /** Total units originally packed for this product on the holiday */
  totalPackedUnits: number;
  /** Total units remaining (still in packs) for this product on the holiday */
  unitsRemaining: number;
  /** How many units were planned (from pack_list_for_holiday.calculatedAmount) */
  calculatedAmount: number | null;
  /** Per-pack breakdown: packId → { packed, remaining } */
  packBreakdown: { packId: string; packedUnits: number }[];
};

/**
 * Returns whether a product is part of the current active holiday's pack list,
 * plus detailed packing info when it is.
 */
export function useIsProductOnActiveHoliday(productId: string): HolidayProductInfo {
  const activeHolidayQ = useActiveHoliday();
  const packListQ = usePackListForHoliday(activeHolidayQ.data?.id);
  const packsForHolidayQ = useGetPacksForHoliday(activeHolidayQ.data?.id ?? "");

  const result = useMemo((): HolidayProductInfo => {
    const base = {
      activeHoliday: null as Holiday | null,
      totalPackedUnits: 0,
      unitsRemaining: 0,
      calculatedAmount: null as number | null,
      packBreakdown: [] as { packId: string; packedUnits: number }[],
    };

    if (!activeHolidayQ.data) {
      return { ...base, isOnHoliday: false, hasActiveHoliday: false, isLoading: activeHolidayQ.isPending, activeHolidayId: undefined };
    }
    if (packListQ.isPending || packsForHolidayQ.isPending) {
      return { ...base, isOnHoliday: false, hasActiveHoliday: true, isLoading: true, activeHolidayId: activeHolidayQ.data.id, activeHoliday: activeHolidayQ.data };
    }

    const packListEntry = packListQ.data?.find(item => item.productId === productId);
    const isOnHoliday = !!packListEntry;

    if (!isOnHoliday) {
      return { ...base, isOnHoliday: false, hasActiveHoliday: true, isLoading: false, activeHolidayId: activeHolidayQ.data.id, activeHoliday: activeHolidayQ.data };
    }

    // Build pack breakdown for this product
    const productPacks = (packsForHolidayQ.data ?? []).filter(p => p.productId === productId);
    const packBreakdown = productPacks.map(p => ({ packId: p.packId, packedUnits: p.units }));
    const totalPackedUnits = productPacks.reduce((sum, p) => sum + p.units, 0);

    return {
      isOnHoliday: true,
      hasActiveHoliday: true,
      isLoading: false,
      activeHolidayId: activeHolidayQ.data.id,
      activeHoliday: activeHolidayQ.data,
      totalPackedUnits,
      unitsRemaining: totalPackedUnits, // Will be refined by consumers with actual pack data
      calculatedAmount: packListEntry.calculatedAmount ?? null,
      packBreakdown,
    };
  }, [activeHolidayQ.data, activeHolidayQ.isPending, packListQ.data, packListQ.isPending, packsForHolidayQ.data, packsForHolidayQ.isPending, productId]);

  return result;
}
