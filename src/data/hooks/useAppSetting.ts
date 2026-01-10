import { useDatabase } from "@/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { appSettingsRepo } from "../appSettingsRepo";
import { qk } from "../queryKeys";

export function useAppSetting<T = any>(key: string) {
  const { db, ready } = useDatabase();
  const repo = useMemo(() => (db ? appSettingsRepo(db) : null), [db]);

  return useQuery({
    queryKey: qk.appSetting(key),
    enabled: ready && !!db && !!key,
    queryFn: () => repo!.getByKey<T>(key),
    staleTime: 0,
  });
}
