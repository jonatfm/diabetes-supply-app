import { useDatabase } from "@/db";
import { HOLIDAY_ITEM_METHODS } from "@/db/schema";
import { computeAmountForMethod } from "@/src/utils/calculateHolidayNeeds";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { holidayRepo } from "../holidayRepo";
import { qk } from "../queryKeys";

export function useUpdateHoliday() {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? holidayRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      holidayId: string;
      destination: string;
      durationDays: number;
      startDate?: string | null;
      endDate?: string | null;
      products: {
        [productId: string]: {
          amountCalculationType: typeof HOLIDAY_ITEM_METHODS[number];
          amountCalculationAttributes: Record<string, any>;
        };
      };
    }) => {
      if (!repo) throw new Error("Database not ready");

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

      await repo.updatePlannedHoliday(params.holidayId, {
        destination: params.destination,
        durationDays: params.durationDays,
        startDate: params.startDate,
        endDate: params.endDate,
        products: params.products,
        snapshotAmounts,
      });
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.holidays() }),
        qc.invalidateQueries({ queryKey: qk.holiday(variables.holidayId) }),
        qc.invalidateQueries({ queryKey: qk.packListForHoliday(variables.holidayId) }),
      ]);
    },
  });
}
