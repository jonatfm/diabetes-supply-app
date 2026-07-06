import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { invalidateProductInventory } from "../invalidation";
import { ChangesFormat, packsRepo } from "../packsRepo";
import { qk } from "../queryKeys";

export function useSaveManualPacksChanges(productId: string) {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? packsRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (changes: ChangesFormat) => {
      await repo!.manualDataUpdate(changes);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.product(productId) }),
        invalidateProductInventory(qc, productId),
      ]);
    },
  });
}
