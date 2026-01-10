import { useDatabase } from "@/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { appSettingsRepo } from "../appSettingsRepo";
import { qk } from "../queryKeys";

export function useUpsertAppSetting() {
  const { db } = useDatabase();
  const repo = useMemo(() => (db ? appSettingsRepo(db) : null), [db]);
  const qc = useQueryClient();

  return useMutation<string, unknown, { key: string; value: any; updatedAt?: number }>({
    mutationFn: async (params) => {
      await repo!.upsert(params.key, params.value, params.updatedAt);
      return params.key;
    },
    onSuccess: async (key) => {
      await qc.invalidateQueries({ queryKey: qk.appSetting(key) });
    },
  });
}
