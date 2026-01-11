import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { coloredDotsRepo } from "../coloredDotsRepo";
import { qk } from "../queryKeys";

export function useGenerateUniqueDotCombination(productId: string, options?: { enabled?: boolean }) {
  const { db, ready } = useDatabase();
  const repo = useMemo(() => (db ? coloredDotsRepo(db) : null), [db]);
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: qk.dotCombination(productId),
    enabled: enabled && ready && !!db && !!productId,
    queryFn: () => repo!.generateUniqueCombinationForProduct(productId),
    staleTime: 0,
  });
}
