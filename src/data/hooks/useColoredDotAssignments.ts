import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { coloredDotsRepo } from "../coloredDotsRepo";
import { qk } from "../queryKeys";

export function useColoredDotAssignments(packId: string) {
  const { db, ready } = useDatabase();
  const repo = useMemo(() => (db ? coloredDotsRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.coloredDotAssignments(packId),
    enabled: ready && !!db && !!packId,
    queryFn: () => repo!.getAssignmentByPackId(packId),
    staleTime: 0,
  });
}
