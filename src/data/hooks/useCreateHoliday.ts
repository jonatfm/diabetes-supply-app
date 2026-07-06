import { useDatabase } from "@/db";
import { HOLIDAY_ITEM_METHODS } from "@/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { computeAmountForMethod } from "@/src/utils/calculateHolidayNeeds";
import { holidayRepo } from "../holidayRepo";
import { qk } from "../queryKeys";

export function useCreateHoliday() {
  const {db} = useDatabase();
  const repo = useMemo(() => (db ? holidayRepo(db) : null), [db]);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      destination: string;
      durationDays: number;
      products: {
        [productId: string]: {
          amountCalculationType: typeof HOLIDAY_ITEM_METHODS[number];
          amountCalculationAttributes: Record<string, any>;
        };
      };
    }) => {
      // Snapshot amounts at creation time so they never drift with usage stats
      const snapshotAmounts: Record<string, number> = {};
      await Promise.all(
        Object.entries(params.products).map(async ([productId, { amountCalculationType, amountCalculationAttributes }]) => {
          snapshotAmounts[productId] = await computeAmountForMethod(
            productId,
            params.durationDays,
            amountCalculationType,
            amountCalculationAttributes,
          );
        }),
      );
      return repo!.createHoliday(params.destination, params.durationDays, params.products, snapshotAmounts);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.holidays() });
    },
  });
}
