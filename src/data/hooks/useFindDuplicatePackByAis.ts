import { useDatabase } from "@/db";
import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { packsRepo } from "../packsRepo";

export function useFindDuplicatePackByAis() {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? packsRepo(db) : null), [db]);

  return useMutation({
    mutationFn: (params: { productId: string; ais: Record<string, string> }) =>
      repo!.findDuplicatePackByAis(params.productId, params.ais),
  });
}
