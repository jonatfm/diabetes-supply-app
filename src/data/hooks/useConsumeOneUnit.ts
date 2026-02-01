import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { packsRepo } from "../packsRepo";
import { qk } from "../queryKeys";

export function useConsumeOneUnit(productId: string) {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? packsRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ packId }: { packId: string }) => repo!.consumeOneUnit(productId, packId),
    onSuccess: async (_, { packId }) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.packs(productId) }),
        qc.invalidateQueries({ queryKey: qk.totalUnits(productId) }),
        qc.invalidateQueries({ queryKey: qk.history(productId) }),
        qc.invalidateQueries({ queryKey: qk.pack(packId) }),
        qc.invalidateQueries({ queryKey: qk.session(productId) }),
        qc.invalidateQueries({ queryKey: qk.sessionOutcomeStatsByProduct(productId) }),
        qc.invalidateQueries({ queryKey: qk.averageTimeBetweenTakes(productId) }),
        qc.invalidateQueries({ queryKey: qk.takeEventStatistics(productId) }),
        qc.invalidateQueries({ queryKey: qk.sessionStatistics(productId) }),
        qc.invalidateQueries({ queryKey: qk.daysUntilOutOfStock(productId) }),
      ]);
    },
  });
}
