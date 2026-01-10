import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { qk } from "../queryKeys";
import { sessionsRepo } from "../sessionsRepo";

export function useGetSessionOutcomeStatsByProduct(productId: string) {
  const {db, ready} = useDatabase();
  const repo = useMemo(() => (db ? sessionsRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.sessionOutcomeStatsByProduct(productId),
    enabled: ready && !!db && !!productId,
    queryFn: () => repo!.getSessionOutcomeStatsByProduct(productId),
    staleTime: 0,
  })
}