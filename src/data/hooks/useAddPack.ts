import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
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
    }) => repo!.addPackWithStockEvent({ ...params, productId }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.packs(productId) }),
        qc.invalidateQueries({ queryKey: qk.totalUnits(productId) }),
        qc.invalidateQueries({ queryKey: qk.history(productId) }),
      ]);
    },
  });
}
