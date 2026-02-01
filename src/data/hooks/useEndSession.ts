import { useDatabase } from "@/db";
import { SessionOutcome } from "@/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { qk } from "../queryKeys";
import { sessionsRepo } from "../sessionsRepo";

export function useEndSession() {
  const {db} = useDatabase();
  const repo = useMemo(() => (db ? sessionsRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      sessionId: string;
      endedAt: Date;
      outcome: SessionOutcome;
    }) => repo!.endSession(params.sessionId, params.endedAt, params.outcome),
    onSuccess: async() => {
      await qc.invalidateQueries({queryKey: qk.sessions()});
      // Invalidate all session queries to ensure child queries stay in sync
      await qc.invalidateQueries({queryKey: ["session"]});
      // Invalidate statistics queries
      await qc.invalidateQueries({queryKey: ["sessionStatistics"]});
      await qc.invalidateQueries({queryKey: ["daysUntilOutOfStock"]});
    }
  })
}