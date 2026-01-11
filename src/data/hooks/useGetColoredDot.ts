import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { coloredDotsRepo } from "../coloredDotsRepo";
import { qk } from "../queryKeys";

export function useGetColoredDot(id: string) {
  const { db, ready } = useDatabase();
  const repo = useMemo(() => (db ? coloredDotsRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.coloredDot(id),
    enabled: ready && !!db,
    queryFn: () => repo!.getDot(id),
    staleTime: 0,
  });
}
