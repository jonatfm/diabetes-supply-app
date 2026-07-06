import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { invalidateHolidayReservations, invalidateProductInventory, invalidateProductSessions, invalidateProductUsageStats } from "../invalidation";
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
        invalidateProductInventory(qc, productId),
        qc.invalidateQueries({ queryKey: qk.pack(packId) }),
        invalidateProductSessions(qc, productId),
        invalidateProductUsageStats(qc, productId),
        invalidateHolidayReservations(qc),
      ]);
    },
  });
}
