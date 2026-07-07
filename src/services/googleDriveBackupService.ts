import { DatabaseExportData } from "@/src/data/hooks/useExportDatabase";

export type GoogleDriveBackupFile = {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
};

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const BACKUP_APP_PROPERTY = "diabetesSupplyBackup";
const BACKUP_APP_PROPERTY_VALUE = "true";

function driveHeaders(accessToken: string, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  };
}

async function parseDriveResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return await response.json() as T;
  }

  let detail = "";
  try {
    const body = await response.json();
    detail = body?.error?.message ? `: ${body.error.message}` : "";
  } catch {
    detail = "";
  }

  throw new Error(`Google Drive request failed (${response.status})${detail}`);
}

export async function uploadBackupToGoogleDrive(params: {
  accessToken: string;
  fileName: string;
  data: DatabaseExportData;
  folderId?: string | null;
}): Promise<GoogleDriveBackupFile> {
  const boundary = `diabetes_supply_${Date.now()}`;
  const metadata = {
    name: params.fileName,
    mimeType: "application/json",
    appProperties: {
      [BACKUP_APP_PROPERTY]: BACKUP_APP_PROPERTY_VALUE,
    },
    ...(params.folderId ? { parents: [params.folderId] } : {}),
  };
  const content = JSON.stringify(params.data, null, 2);
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const response = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,modifiedTime,size`, {
    method: "POST",
    headers: driveHeaders(params.accessToken, {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    }),
    body,
  });

  return parseDriveResponse<GoogleDriveBackupFile>(response);
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function listGoogleDriveBackups(accessToken: string, folderId?: string | null): Promise<GoogleDriveBackupFile[]> {
  const query = [
    "trashed = false",
    `appProperties has { key='${BACKUP_APP_PROPERTY}' and value='${BACKUP_APP_PROPERTY_VALUE}' }`,
    ...(folderId ? [`'${escapeDriveQueryValue(folderId)}' in parents`] : []),
  ].join(" and ");
  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name,modifiedTime,size)",
    orderBy: "modifiedTime desc",
    pageSize: "10",
  });

  const response = await fetch(`${DRIVE_FILES_URL}?${params.toString()}`, {
    headers: driveHeaders(accessToken),
  });
  const result = await parseDriveResponse<{ files?: GoogleDriveBackupFile[] }>(response);

  return result.files ?? [];
}

export async function deleteGoogleDriveFile(params: {
  accessToken: string;
  fileId: string;
}): Promise<void> {
  const response = await fetch(`${DRIVE_FILES_URL}/${params.fileId}`, {
    method: "DELETE",
    headers: driveHeaders(params.accessToken),
  });

  if (!response.ok) {
    await parseDriveResponse(response);
  }
}

export async function pruneGoogleDriveBackups(params: {
  accessToken: string;
  folderId?: string | null;
  keepCount: number;
}): Promise<GoogleDriveBackupFile[]> {
  if (params.keepCount <= 0) {
    return [];
  }

  const backups = await listGoogleDriveBackups(params.accessToken, params.folderId);
  const toDelete = backups.slice(params.keepCount);
  await Promise.all(
    toDelete.map((backup) => deleteGoogleDriveFile({
      accessToken: params.accessToken,
      fileId: backup.id,
    })),
  );

  return toDelete;
}

export async function downloadGoogleDriveBackup(params: {
  accessToken: string;
  fileId: string;
}): Promise<string> {
  const response = await fetch(`${DRIVE_FILES_URL}/${params.fileId}?alt=media`, {
    headers: driveHeaders(params.accessToken),
  });

  if (!response.ok) {
    await parseDriveResponse(response);
  }

  return await response.text();
}
