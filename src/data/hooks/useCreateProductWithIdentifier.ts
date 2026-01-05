import { useDatabase } from "@/db";
import { ProductIdentifier } from "@/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { productIdentifiersRepo } from "../productIdentifiersRepo";
import { productRepo } from "../productRepo";
import { qk } from "../queryKeys";

export function useCreateProductWithIdentifier() {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? productRepo(db) : null), [db]);
  const identifiers = useMemo(() => (db ? productIdentifiersRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      unitsPerPack: number;
      canHaveExpiry: boolean;
      imageUri?: string;
      identifier: string;
      identifierType: ProductIdentifier["type"];
    }) => {
      if (!repo || !identifiers) throw new Error("Database not ready");

      const existingIdentifier = await identifiers.findByValue(params.identifier);
      if (existingIdentifier.length > 0) {
        throw new Error("identifier-exists");
      }

      const nameConflict = await repo.findByName(params.name);
      if (nameConflict.length > 0) {
        throw new Error("name-exists");
      }

      const [product] = await repo.createProduct({
        name: params.name,
        unitsPerPackDefault: params.unitsPerPack,
        imageUri: params.imageUri,
        canHaveExpiry: params.canHaveExpiry,
      });

      await identifiers.createIdentifier({
        productId: product.id,
        value: params.identifier,
        type: params.identifierType,
        createdAt: Date.now(),
      });

      return product.id;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.products() });
    },
  });
}
