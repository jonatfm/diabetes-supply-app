import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { qk } from "../queryKeys";
import { sessionsRepo } from "../sessionsRepo";

export function useGetActiveSession(productId: string) {
  const {db, ready} = useDatabase();
  const repo = useMemo(() => (db ? sessionsRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.session(productId),
    enabled: ready && !!db && !!productId,
    queryFn: () => repo!.getActiveSessionByProduct(productId),
    staleTime: 0,
  })
}