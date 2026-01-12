import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { historyRepo } from "../historyRepo";
import { qk } from "../queryKeys";

export function useGetStockHistoryByProduct(productId: string) {
  const { db, ready } = useDatabase();
  const repo = useMemo(() => (db ? historyRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.history(productId),
    enabled: ready && !!db && !!productId,
    queryFn: () => repo!.getStockHistoryByProduct(productId),
    staleTime: 10000, // 10 seconds
  });
}
