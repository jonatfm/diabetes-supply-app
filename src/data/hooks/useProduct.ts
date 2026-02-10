import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { productRepo } from "../productRepo";
import { qk } from "../queryKeys";

export function useProduct(productId: string) {
  const {db, ready} = useDatabase();
  const repo = useMemo(() => (db ? productRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.product(productId),
    enabled: ready && !!db && !!productId,
    queryFn: () => repo!.getProductById(productId),
  })
}