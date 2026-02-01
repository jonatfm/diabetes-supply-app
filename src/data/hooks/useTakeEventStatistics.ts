import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { qk } from "../queryKeys";
import { statisticsRepo } from "../statisticsRepo";

/**
 * Hook to get TAKE event statistics for non-session-based products
 * Returns average time between TAKE events
 */
export function useTakeEventStatistics(productId: string, periodInDays?: number) {
  const { db, ready } = useDatabase();
  const statsRepo = useMemo(() => (db ? statisticsRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.takeEventStatistics(productId, periodInDays),
    enabled: ready && !!db && !!productId,
    staleTime: 0,
    queryFn: async () => {
      return await statsRepo!.getTakeEventStatistics(productId, periodInDays);
    },
  });
}
