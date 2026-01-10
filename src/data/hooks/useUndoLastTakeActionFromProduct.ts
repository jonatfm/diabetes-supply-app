import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { historyRepo } from "../historyRepo";
import { qk } from "../queryKeys";

export function useUndoLastTakeActionFromProduct(productId: string) {
  const {db} = useDatabase();
  const repo = useMemo(() => (db ? historyRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({productId}: {productId: string}) => repo!.undoLastTakeActionFromProduct(productId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.history(productId) }),
        qc.invalidateQueries({ queryKey: qk.packs(productId) }),
        qc.invalidateQueries({ queryKey: qk.totalUnits(productId) }),
        qc.invalidateQueries({ queryKey: qk.session(productId) }),
        qc.invalidateQueries({ queryKey: qk.sessions() }),
        qc.invalidateQueries({ queryKey: qk.product(productId) }),
        qc.invalidateQueries({ queryKey: qk.identifiers(productId) }),
      ]);
    },
  })
}