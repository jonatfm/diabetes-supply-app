import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { historyRepo } from "../historyRepo";
import { packsRepo } from "../packsRepo";
import { qk } from "../queryKeys";

export function useAverageTimeBetweenTakes(productId: string, periodInDays?: number) {
  const { db, ready } = useDatabase();
  const histRepo = useMemo(() => (db ? historyRepo(db) : null), [db]);
  const packsRepository = useMemo(() => (db ? packsRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.averageTimeBetweenTakes(productId, periodInDays),
    enabled: ready && !!db && !!productId,
    queryFn: async () => {
      const takeEvents = await histRepo!.getTakeEventsByProduct(productId, periodInDays);
      
      if (takeEvents.length < 2) {
        return null; // Need at least 2 events to calculate an average
      }

      // Calculate time differences between consecutive events
      const timeDifferences: number[] = [];
      for (let i = 0; i < takeEvents.length - 1; i++) {
        const diff = takeEvents[i].occuredAt - takeEvents[i + 1].occuredAt;
        timeDifferences.push(diff);
      }

      // Calculate average time difference in milliseconds
      const averageMs = timeDifferences.reduce((sum, diff) => sum + diff, 0) / timeDifferences.length;
      const averageDays = averageMs / (1000 * 60 * 60 * 24);

      // Get total units remaining to calculate estimated days until OOS
      const totalUnits = await packsRepository!.totalUnitsByProduct(productId);
      const estimatedDaysUntilOOS = averageDays > 0 ? totalUnits * averageDays : null;

      return {
        averageMs,
        averageHours: averageMs / (1000 * 60 * 60),
        averageDays,
        eventCount: takeEvents.length,
        periodInDays,
        estimatedDaysUntilOOS,
      };
    },
    staleTime: 0,
  });
}
