import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { invalidateProductInventory } from "../invalidation";
import { packsRepo } from "../packsRepo";
import { qk } from "../queryKeys";

export function useAddPack(productId: string) {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? packsRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      expiry?: string;
      productionDate?: string;
      units: number;
      ais?: Record<string, string> | null;
      note?: string;
      timestamp?: number;
      dateSetManually?: boolean;
      coloredDotIds?: string[];
      rawCode: string;
    }) => repo!.addPackWithStockEvent({ ...params, productId }),
    onSuccess: async (newPackId: string) => {
      await Promise.all([
        invalidateProductInventory(qc, productId),
        qc.invalidateQueries({ queryKey: qk.coloredDotAssignments(newPackId) }),
        qc.invalidateQueries({ queryKey: qk.dotCombination(productId) }),
      ]);
    },
  });
}
