import { useDatabase } from "@/db";
import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { productRepo } from "../productRepo";

export function useGetProductByIdImmediate() {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? productRepo(db) : null), [db]);

  return useMutation({
    mutationFn: (productId: string) => repo!.getProductById(productId),
  });
}
