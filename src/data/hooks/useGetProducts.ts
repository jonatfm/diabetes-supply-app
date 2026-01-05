import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { productRepo } from "../productRepo";
import { qk } from "../queryKeys";

export function useProducts() {
  const {db, ready} = useDatabase();
  const repo = useMemo(() => (db ? productRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.products(),
    enabled: ready && !!db,
    queryFn: () => repo!.getAllProducts(),
    staleTime: 0,
  })
}