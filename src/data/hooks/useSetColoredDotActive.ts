import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { coloredDotsRepo } from "../coloredDotsRepo";
import { qk } from "../queryKeys";

export function useSetColoredDotActive() {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? coloredDotsRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => repo!.setActive(id, active),
    onSuccess: async (_data, variables: { id: string; active: boolean }) => {
      await qc.invalidateQueries({ queryKey: qk.coloredDots() });
      await qc.invalidateQueries({ queryKey: qk.coloredDot(variables.id) });
      await qc.invalidateQueries({ queryKey: qk.dotCombinations() });
    },
  });
}
