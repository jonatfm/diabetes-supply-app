import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { holidayRepo } from "../holidayRepo";
import { qk } from "../queryKeys";

/** Starts a packed trip when no other trip is ongoing. */
export function useActivateHoliday() {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? holidayRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (holidayId: string) => {
      if (!repo) throw new Error("Database not ready");
      return repo.activateHoliday(holidayId);
    },
    onSuccess: async (_data, holidayId) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.holidays() }),
        qc.invalidateQueries({ queryKey: qk.holiday(holidayId) }),
        qc.invalidateQueries({ queryKey: qk.activeHoliday() }),
        qc.invalidateQueries({ queryKey: qk.packsForHolidayRoot() }),
        qc.invalidateQueries({ queryKey: qk.upcomingHolidayAllocationsRoot() }),
      ]);
    },
  });
}
