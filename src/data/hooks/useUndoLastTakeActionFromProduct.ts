import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { historyRepo } from "../historyRepo";
import { invalidateHolidayReservations, invalidateProductIdentity, invalidateProductInventory, invalidateProductSessions, invalidateProductUsageStats } from "../invalidation";

export function useUndoLastTakeActionFromProduct(productId: string) {
  const {db} = useDatabase();
  const repo = useMemo(() => (db ? historyRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({productId}: {productId: string}) => repo!.undoLastTakeActionFromProduct(productId),
    onSuccess: async () => {
      await Promise.all([
        invalidateProductInventory(qc, productId),
        invalidateProductSessions(qc, productId),
        invalidateProductUsageStats(qc, productId),
        invalidateProductIdentity(qc, productId),
        invalidateHolidayReservations(qc),
      ]);
    },
  })
}
