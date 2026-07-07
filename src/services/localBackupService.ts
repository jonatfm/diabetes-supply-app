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

export function getLocalBackupDirectory() {
  return new Directory(Paths.document, BACKUP_DIR_NAME);
}

export function getLocalBackupDirectoryUri() {
  return getLocalBackupDirectory().uri;
}

function ensureLocalBackupDirectory() {
  const directory = getLocalBackupDirectory();
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function isBackupFile(file: File) {
  return file.name.startsWith(BACKUP_PREFIX) && file.name.endsWith(BACKUP_EXTENSION);
}

export function listLocalBackups(): LocalBackupFile[] {
  const directory = ensureLocalBackupDirectory();

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

export function writeLocalBackup(data: DatabaseExportData, fileName = `${BACKUP_PREFIX}${Date.now()}${BACKUP_EXTENSION}`) {
  const directory = ensureLocalBackupDirectory();
  const file = new File(directory, fileName);
  file.create({ overwrite: true });
  file.write(JSON.stringify(data, null, 2));

  return {
    name: file.name,
    uri: file.uri,
    modifiedTime: file.modificationTime,
    size: file.size,
  };
}

export function pruneLocalBackups(keepCount: number): LocalBackupFile[] {
  if (keepCount <= 0) {
    return [];
  }

  const backups = listLocalBackups();
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

export function getLatestLocalBackup() {
  return listLocalBackups()[0] ?? null;
}
