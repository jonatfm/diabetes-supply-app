import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { invalidateProductInventory } from "../invalidation";
import { packsRepo } from "../packsRepo";

export function useHandleDiscardExpired(productId: string) {
  const {db} = useDatabase();
  const repo = useMemo(() => (db ? packsRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({productId}: {productId: string}) => repo!.discardExpiredByProduct(productId),
    onSuccess: async () => {
      await invalidateProductInventory(qc, productId);
    },
  })
}
