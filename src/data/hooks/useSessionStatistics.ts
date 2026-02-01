import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { qk } from "../queryKeys";
import { statisticsRepo } from "../statisticsRepo";

/**
 * Hook to get session statistics for session-based products
 * Returns average session duration and average time between sessions
 */
export function useSessionStatistics(productId: string, periodInDays?: number) {
  const { db, ready } = useDatabase();
  const statsRepo = useMemo(() => (db ? statisticsRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.sessionStatistics(productId, periodInDays),
    enabled: ready && !!db && !!productId,
    staleTime: 0,
    queryFn: async () => {
      return await statsRepo!.getSessionStatistics(productId, periodInDays);
    },
  });
}
