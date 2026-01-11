import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { productRepo } from "../productRepo";
import { qk } from "../queryKeys";

export function useUpdateProduct(productId: string) {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? productRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { name?: string; imageUri?: string | null; useColoredDots?: boolean }) => {
      if (!repo) throw new Error("Database not ready");
      await repo.updateProduct(productId, params);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.product(productId) });
      await qc.invalidateQueries({ queryKey: qk.products() });
    },
  });
}
