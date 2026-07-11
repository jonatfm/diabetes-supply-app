import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { holidayRepo } from "../holidayRepo";
import { qk } from "../queryKeys";

export function useAddPackToHoliday() {
  const {db} = useDatabase();
  const repo = useMemo(() => (db ? holidayRepo(db) : null), [db]);
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: (params: { holidayId: string; packId: string; units: number }) => 
      repo!.addPackToHoliday(params.holidayId, params.packId, params.units),
    onSuccess: async (_, variables) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.packsForHoliday(variables.holidayId) }),
        qc.invalidateQueries({ queryKey: qk.upcomingHolidayAllocationsRoot() }),
      ]);
    },
  });
}
