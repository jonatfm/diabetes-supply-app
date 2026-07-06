import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { productRepo } from "../productRepo";
import { qk } from "../queryKeys";

export function useUpdateAnyProduct() {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? productRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { 
      productId: string;
      name?: string; 
      imageUri?: string | null; 
      unitsPerPackDefault?: number;
      active?: boolean;
      canHaveExpiry?: boolean;
      isSessionBased?: boolean;
      nominalSessionTimeDays?: number | null;
      useColoredDots?: boolean; 
      requiredForHoliday?: boolean 
    }) => {
      if (!repo) throw new Error("Database not ready");
      const { productId, ...updateParams } = params;
      await repo.updateProduct(productId, updateParams);
      return productId;
    },
    onSuccess: async (productId) => {
      await qc.invalidateQueries({ queryKey: qk.product(productId) });
      await qc.invalidateQueries({ queryKey: qk.products() });
    },
  });
}
