import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { packsRepo } from "../packsRepo";
import { qk } from "../queryKeys";

export function usePacks(productId: string) {
  const { db, ready } = useDatabase();
  const repo = useMemo(() => (db ? packsRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.packs(productId),
    enabled: ready && !!db && !!productId,
    queryFn: () => repo!.listActiveNonEmptyByProduct(productId),
    staleTime: 0,
  });
}
