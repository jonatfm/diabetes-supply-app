import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { packsRepo } from "../packsRepo";
import { qk } from "../queryKeys";

export function useFetchPack(packId: string) {
  const {db, ready} = useDatabase();
  const repo = useMemo(() => (db ? packsRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.pack(packId),
    enabled: ready && !!db && !!packId,
    queryFn: () => repo!.fetchPackById(packId),
    staleTime: 0,
  })
}