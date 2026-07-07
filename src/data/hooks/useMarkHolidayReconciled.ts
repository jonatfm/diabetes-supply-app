import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { holidayRepo } from "../holidayRepo";
import { qk } from "../queryKeys";

export function useMarkHolidayReconciled() {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? holidayRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (holidayId: string) => {
      if (!repo) throw new Error("Database not ready");
      await repo.markReturnHomeReconciled(holidayId);
    },
    onSuccess: async (_data, holidayId) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.holidays() }),
        qc.invalidateQueries({ queryKey: qk.holiday(holidayId) }),
      ]);
    },
  });
}
