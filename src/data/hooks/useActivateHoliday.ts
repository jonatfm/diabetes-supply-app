import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { holidayRepo } from "../holidayRepo";
import { qk } from "../queryKeys";

/**
 * Activates a holiday by its ID. Deactivates any previously active holiday first
 * so that at most one holiday is active at any time.
 */
export function useActivateHoliday() {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? holidayRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (holidayId: string) => repo!.activateHoliday(holidayId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.holidays() });
      await qc.invalidateQueries({ queryKey: qk.activeHoliday() });
    },
  });
}
