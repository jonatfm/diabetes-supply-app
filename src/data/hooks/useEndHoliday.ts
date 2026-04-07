import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { holidayRepo } from "../holidayRepo";
import { qk } from "../queryKeys";

export function useEndHoliday() {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? holidayRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (holidayId: string) => repo!.endHoliday(holidayId),
    onSuccess: async (_data, holidayId) => {
      await qc.invalidateQueries({ queryKey: qk.holidays() });
      await qc.invalidateQueries({ queryKey: qk.activeHoliday() });
      await qc.invalidateQueries({ queryKey: qk.holiday(holidayId) });
    },
  });
}
