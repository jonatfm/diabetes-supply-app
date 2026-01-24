import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { holidayRepo } from "../holidayRepo";
import { qk } from "../queryKeys";

export function useRemoveUsualProductForHoliday() {
  const {db, ready} = useDatabase();
  const repo = useMemo(() => (db ? holidayRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      productId: string;
    }) => repo!.removeUsualProductForHoliday(params.productId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.usualProductsForHoliday() });
    }
  })
}