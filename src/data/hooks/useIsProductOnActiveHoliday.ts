import { useMemo } from "react";
import { useActiveHoliday } from "./useActiveHoliday";
import { usePackListForHoliday } from "./usePackListForHoliday";

/**
 * Returns whether a product is part of the current active holiday's pack list.
 * If no holiday is active, returns `{ isOnHoliday: false, hasActiveHoliday: false }`.
 */
export function useIsProductOnActiveHoliday(productId: string) {
  const activeHolidayQ = useActiveHoliday();
  const packListQ = usePackListForHoliday(activeHolidayQ.data?.id);

  const result = useMemo(() => {
    if (!activeHolidayQ.data) {
      return { isOnHoliday: false, hasActiveHoliday: false, isLoading: activeHolidayQ.isPending };
    }
    if (packListQ.isPending) {
      return { isOnHoliday: false, hasActiveHoliday: true, isLoading: true };
    }
    const isOnHoliday = packListQ.data?.some(item => item.productId === productId) ?? false;
    return { isOnHoliday, hasActiveHoliday: true, isLoading: false };
  }, [activeHolidayQ.data, activeHolidayQ.isPending, packListQ.data, packListQ.isPending, productId]);

  return result;
}
