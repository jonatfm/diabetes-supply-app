import { useDatabase } from "@/db";
import { holidayRepo } from "@/src/data/holidayRepo";
import { qk } from "@/src/data/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteHoliday() {
  const { db } = useDatabase();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (holidayId: string) => {
      if (!db) {
        throw new Error("Database not ready");
      }

      await holidayRepo(db).deleteHoliday(holidayId);
      return holidayId;
    },
    onSuccess: async (holidayId) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.holidays() }),
        qc.invalidateQueries({ queryKey: qk.activeHoliday() }),
        qc.invalidateQueries({ queryKey: qk.packListForHoliday(holidayId) }),
        qc.invalidateQueries({ queryKey: qk.packsForHoliday(holidayId) }),
        qc.invalidateQueries({ queryKey: qk.packsForHolidayRoot() }),
        qc.invalidateQueries({ queryKey: qk.upcomingHolidayAllocationsRoot() }),
      ]);
    },
  });
}
