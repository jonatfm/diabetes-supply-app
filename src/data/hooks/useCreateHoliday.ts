import { useDatabase } from "@/db";
import { HOLIDAY_ITEM_METHODS } from "@/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { holidayRepo } from "../holidayRepo";

export function useCreateHoliday() {
  const {db} = useDatabase();
  const repo = useMemo(() => (db ? holidayRepo(db) : null), [db]);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { destination: string; durationDays: number; products: { [productId: string]: { amountCalculationType: typeof HOLIDAY_ITEM_METHODS[number]; amountCalculationAttributes: Record<string, any> } } }) => repo!.createHoliday(params.destination, params.durationDays, params.products),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["holidays"] });
    },
  });
}