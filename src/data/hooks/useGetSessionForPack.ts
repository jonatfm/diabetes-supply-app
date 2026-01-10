import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { qk } from "../queryKeys";
import { sessionsRepo } from "../sessionsRepo";

export function useGetSessionForPack(packId: string) {
  const {db, ready} = useDatabase();
  const repo = useMemo(() => (db ? sessionsRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.session(packId),
    enabled: ready && !!db && !!packId,
    queryFn: () => repo!.getSessionForPack(packId),
    staleTime: 0,
  })
}