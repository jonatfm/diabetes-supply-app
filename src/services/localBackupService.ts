import { DatabaseExportData } from "@/src/data/hooks/useExportDatabase";
import { Directory, File, Paths } from "expo-file-system";

export type LocalBackupFile = {
  name: string;
  uri: string;
  modifiedTime: number | null;
  size: number;
};

const BACKUP_DIR_NAME = "automatic-backups";
const BACKUP_PREFIX = "diabetes-supply-backup-";
const BACKUP_EXTENSION = ".json";

export function getLocalBackupDirectory(directoryUri?: string | null) {
  return directoryUri?.trim()
    ? new Directory(directoryUri)
    : new Directory(Paths.document, BACKUP_DIR_NAME);
}

export function getLocalBackupDirectoryUri(directoryUri?: string | null) {
  return getLocalBackupDirectory(directoryUri).uri;
}

export async function pickLocalBackupDirectory() {
  const directory = await Directory.pickDirectoryAsync();
  return directory.uri;
}

function ensureLocalBackupDirectory(directoryUri?: string | null) {
  const directory = getLocalBackupDirectory(directoryUri);
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}

function isBackupFile(file: File) {
  return file.name.startsWith(BACKUP_PREFIX) && file.name.endsWith(BACKUP_EXTENSION);
}

function backupFileName(baseTimestamp: number, attempt: number) {
  const suffix = attempt === 0 ? "" : `-${attempt}`;
  return `${BACKUP_PREFIX}${baseTimestamp}${suffix}${BACKUP_EXTENSION}`;
}

function createBackupFile(directory: Directory, fileName: string) {
  try {
    return directory.createFile(fileName, "application/json");
  } catch (error) {
    if (error instanceof Error && error.message.includes("same name already exists")) {
      throw error;
    }

    throw error;
  }
}

export function listLocalBackups(directoryUri?: string | null): LocalBackupFile[] {
  const directory = ensureLocalBackupDirectory(directoryUri);

  return directory
    .list()
    .filter((entry): entry is File => entry instanceof File && isBackupFile(entry))
    .map((file) => ({
      name: file.name,
      uri: file.uri,
      modifiedTime: file.modificationTime,
      size: file.size,
    }))
    .sort((a, b) => (b.modifiedTime ?? 0) - (a.modifiedTime ?? 0));
}

export function writeLocalBackup(
  data: DatabaseExportData,
  fileName = backupFileName(Date.now(), 0),
  directoryUri?: string | null,
) {
  const directory = ensureLocalBackupDirectory(directoryUri);
  let file: File | null = null;
  const timestamp = Date.now();

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      file = createBackupFile(directory, attempt === 0 ? fileName : backupFileName(timestamp, attempt));
      break;
    } catch (error) {
      if (error instanceof Error && error.message.includes("same name already exists")) {
        continue;
      }

      throw error;
    }
  }

  if (!file) {
    throw new Error("Could not create a local backup file. Try another backup location.");
  }

  file.write(JSON.stringify(data, null, 2));

  return {
    name: file.name,
    uri: file.uri,
    modifiedTime: file.modificationTime,
    size: file.size,
  };
}

export function pruneLocalBackups(keepCount: number, directoryUri?: string | null): LocalBackupFile[] {
  if (keepCount <= 0) {
    return [];
  }

  const backups = listLocalBackups(directoryUri);
  const toDelete = backups.slice(keepCount);
  for (const backup of toDelete) {
    try {
      new File(backup.uri).delete();
    } catch {
      // Ignore stale files; another cleanup can retry later.
    }
  }

  return toDelete;
}

export function getLatestLocalBackup(directoryUri?: string | null) {
  return listLocalBackups(directoryUri)[0] ?? null;
}
