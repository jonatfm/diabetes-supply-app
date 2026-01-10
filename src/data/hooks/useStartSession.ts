import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { qk } from "../queryKeys";
import { sessionsRepo } from "../sessionsRepo";

export function useStartSession() {
  const {db} = useDatabase();
  const repo = useMemo(() => (db ? sessionsRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      productId: string;
      packId: string;
      startedAt: Date;
    }) => repo!.startSession(params.productId, params.packId, params.startedAt),
    onSuccess: async(_, { productId }) => {
      await Promise.all([
        qc.invalidateQueries({queryKey: qk.sessions()}),
        qc.invalidateQueries({queryKey: qk.session(productId)}),
      ]);
    }
  })
}