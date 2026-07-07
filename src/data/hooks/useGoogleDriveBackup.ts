import { useDatabase } from "@/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import { buildDatabaseExportData } from "./useExportDatabase";
import { restoreImportFromFile } from "./useImportDatabase";
import { downloadGoogleDriveBackup, listGoogleDriveBackups, pruneGoogleDriveBackups, uploadBackupToGoogleDrive } from "@/src/services/googleDriveBackupService";

export type GoogleDriveBackupFrequency = "manual" | "daily" | "weekly" | "monthly";

function requireAccessToken(accessToken: string | null | undefined) {
  const token = accessToken?.trim();
  if (!token) {
    throw new Error("Google Drive access token is required.");
  }

  return token;
}

export async function performGoogleDriveBackup(params: {
  db: NonNullable<ReturnType<typeof useDatabase>["db"]>;
  accessToken: string;
  folderId?: string | null;
  retentionCount?: number | null;
}) {
  const data = await buildDatabaseExportData(params.db);
  const uploaded = await uploadBackupToGoogleDrive({
    accessToken: params.accessToken,
    fileName: `diabetes-supply-backup-${Date.now()}.json`,
    data,
    folderId: params.folderId,
  });
  const pruned = params.retentionCount
    ? await pruneGoogleDriveBackups({
      accessToken: params.accessToken,
      folderId: params.folderId,
      keepCount: params.retentionCount,
    })
    : [];

  return { uploaded, pruned };
}

export function shouldRunGoogleDriveBackup(params: {
  frequency: GoogleDriveBackupFrequency | null | undefined;
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

export function useGoogleDriveBackups(accessToken: string | null | undefined, folderId?: string | null) {
  return useQuery({
    queryKey: ["googleDriveBackups", accessToken ? "configured" : "missing", folderId ?? "root"],
    enabled: !!accessToken?.trim(),
    queryFn: () => listGoogleDriveBackups(requireAccessToken(accessToken), folderId),
  });
}

export function useUploadGoogleDriveBackup(
  accessToken: string | null | undefined,
  folderId?: string | null,
  retentionCount?: number | null,
) {
  const { db, ready } = useDatabase();

  return useMutation({
    mutationFn: async () => {
      if (!db || !ready) {
        throw new Error("Database not ready");
      }

      const token = requireAccessToken(accessToken);
      return performGoogleDriveBackup({
        db,
        accessToken: token,
        folderId,
        retentionCount,
      });
    },
  });
}

export function useRestoreLatestGoogleDriveBackup(accessToken: string | null | undefined, folderId?: string | null) {
  const { db, ready } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!db || !ready) {
        throw new Error("Database not ready");
      }

      const token = requireAccessToken(accessToken);
      const backups = await listGoogleDriveBackups(token, folderId);
      const latest = backups[0];
      if (!latest) {
        throw new Error("No Google Drive backups found.");
      }

      const content = await downloadGoogleDriveBackup({
        accessToken: token,
        fileId: latest.id,
      });
      const restoreFile = new File(Paths.cache, `google-drive-restore-${Date.now()}.json`);
      restoreFile.create({ overwrite: true });
      restoreFile.write(content);

      return restoreImportFromFile(db, queryClient, restoreFile.uri, {
        cleanupPickedFile: true,
      });
    },
  });
}
