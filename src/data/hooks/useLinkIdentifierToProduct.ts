import { useDatabase } from "@/db";
import { ProductIdentifier } from "@/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { productIdentifiersRepo } from "../productIdentifiersRepo";
import { qk } from "../queryKeys";

export function useLinkIdentifierToProduct() {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? productIdentifiersRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (params: { productId: string; value: string; type: ProductIdentifier["type"]; createdAt?: number }) =>
      repo!.createIdentifier(params),
    onSuccess: async (_, variables) => {
      await qc.invalidateQueries({ queryKey: qk.identifiers(variables.productId) });
    },
  });
}
