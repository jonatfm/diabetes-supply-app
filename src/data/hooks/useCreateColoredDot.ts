import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { coloredDotsRepo } from "../coloredDotsRepo";
import { qk } from "../queryKeys";

export function useCreateColoredDot() {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? coloredDotsRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (params: { color: string; active?: boolean }) => repo!.createDot(params),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.coloredDots() });
    },
  });
}
