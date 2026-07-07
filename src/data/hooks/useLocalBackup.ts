import { useDatabase } from "@/db";
import { getLatestLocalBackup, getLocalBackupDirectoryUri, listLocalBackups, pruneLocalBackups, writeLocalBackup } from "@/src/services/localBackupService";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Sharing from "expo-sharing";
import { buildDatabaseExportData } from "./useExportDatabase";
import { restoreImportFromFile } from "./useImportDatabase";

export type BackupFrequency = "manual" | "daily" | "weekly" | "monthly";

export function shouldRunBackup(params: {
  frequency: BackupFrequency | null | undefined;
  lastBackupAt?: number | null;
  now?: number;
}) {
  const frequency = params.frequency ?? "manual";
  if (frequency === "manual") {
    return false;
  }

  const intervalMs = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
  }[frequency];
  const now = params.now ?? Date.now();

  return !params.lastBackupAt || now - params.lastBackupAt >= intervalMs;
}

export async function performLocalBackup(params: {
  db: NonNullable<ReturnType<typeof useDatabase>["db"]>;
  retentionCount?: number | null;
}) {
  const data = await buildDatabaseExportData(params.db);
  const backup = writeLocalBackup(data);
  const pruned = params.retentionCount
    ? pruneLocalBackups(params.retentionCount)
    : [];

  return { backup, pruned };
}

export function useLocalBackups() {
  return useQuery({
    queryKey: ["localBackups"],
    queryFn: () => listLocalBackups(),
  });
}

export function useCreateLocalBackup(retentionCount?: number | null) {
  const { db, ready } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!db || !ready) {
        throw new Error("Database not ready");
      }

      return performLocalBackup({ db, retentionCount });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["localBackups"] });
    },
  });
}

export function useRestoreLatestLocalBackup() {
  const { db, ready } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!db || !ready) {
        throw new Error("Database not ready");
      }

      const latest = getLatestLocalBackup();
      if (!latest) {
        throw new Error("No local backups found.");
      }

      return restoreImportFromFile(db, queryClient, latest.uri);
    },
  });
}

export function useShareLatestLocalBackup() {
  return useMutation({
    mutationFn: async () => {
      const latest = getLatestLocalBackup();
      if (!latest) {
        throw new Error("No local backups found.");
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error("Sharing is not available on this device");
      }

      await Sharing.shareAsync(latest.uri, {
        mimeType: "application/json",
        dialogTitle: "Share Local Backup",
        UTI: "public.json",
      });

      return latest;
    },
  });
}

export { getLocalBackupDirectoryUri };
