import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { holidayRepo } from "../holidayRepo";
import { qk } from "../queryKeys";

/** Reservations for planned or packed (not yet active) trips. */
export function useUpcomingHolidayAllocationsForProduct(productId: string) {
  const { db, ready } = useDatabase();
  const repo = useMemo(() => (db ? holidayRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.upcomingHolidayAllocations(productId),
    enabled: ready && !!repo && !!productId,
    queryFn: () => repo!.getUpcomingHolidayAllocationsForProduct(productId),
  });
}
