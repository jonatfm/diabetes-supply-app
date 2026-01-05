import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { productIdentifiersRepo } from "../productIdentifiersRepo";
import { qk } from "../queryKeys";

export function useProductIdentifiers(productId: string) {
  const {db, ready} = useDatabase();
  const repo = useMemo(() => (db ? productIdentifiersRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.identifiers(productId),
    enabled: ready && !!db && !!productId,
    queryFn: () => repo!.getIdentifiersByProductId(productId),
    staleTime: 0,
  })
}
