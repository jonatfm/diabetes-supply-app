import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { coloredDotsRepo } from "../coloredDotsRepo";
import { qk } from "../queryKeys";

export function useAssignDotsToPack(packId: string) {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? coloredDotsRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (dotIds: string[]) => repo!.setAssignmentForPack(packId, dotIds),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.coloredDotAssignments(packId) });
    },
  });
}
