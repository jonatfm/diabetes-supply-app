import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { packsRepo } from "../packsRepo";
import { qk } from "../queryKeys";

export function useHandleDiscardExpired(productId: string) {
  const {db} = useDatabase();
  const repo = useMemo(() => (db ? packsRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({productId}: {productId: string}) => repo!.discardExpiredByProduct(productId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.packs(productId) });
      await qc.invalidateQueries({ queryKey: qk.totalUnits(productId) });
    },
  })
}