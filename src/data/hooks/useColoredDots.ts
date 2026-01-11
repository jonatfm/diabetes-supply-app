import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { coloredDotsRepo } from "../coloredDotsRepo";
import { qk } from "../queryKeys";

export function useColoredDots(options?: { includeInactive?: boolean }) {
  const { db, ready } = useDatabase();
  const repo = useMemo(() => (db ? coloredDotsRepo(db) : null), [db]);
  const includeInactive = options?.includeInactive ?? false;

  return useQuery({
    queryKey: qk.coloredDots(),
    enabled: ready && !!db,
    queryFn: () => (includeInactive ? repo!.getAll() : repo!.getActive()),
    staleTime: 0,
  });
}
