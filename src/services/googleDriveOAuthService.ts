import { appSettingsRepo } from "@/src/data/appSettingsRepo";
import { AuthRequest, exchangeCodeAsync, makeRedirectUri, refreshAsync, ResponseType, revokeAsync } from "expo-auth-session";

type Db = Parameters<typeof appSettingsRepo>[0];

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

export function getGoogleDriveOAuthRedirectUri() {
  return makeRedirectUri({
    scheme: "diabetessupplyapp",
    path: "oauth/google",
  });
}

function accessTokenExpiresAt(expiresIn?: number) {
  return expiresIn ? Date.now() + expiresIn * 1000 : null;
}

async function upsertTokenSettings(db: Db, params: {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
}) {
  const settings = appSettingsRepo(db);
  await settings.upsert("googleDriveAccessToken", params.accessToken);
  await settings.upsert("googleDriveAccessTokenExpiresAt", params.expiresAt ?? null);
  if (params.refreshToken) {
    await settings.upsert("googleDriveRefreshToken", params.refreshToken);
  }
}

export async function connectGoogleDriveOAuth(params: {
  db: Db;
  clientId: string;
  redirectUri?: string | null;
}) {
  const clientId = params.clientId.trim();
  if (!clientId) {
    throw new Error("Google OAuth client ID is required.");
  }

  const redirectUri = params.redirectUri?.trim() || getGoogleDriveOAuthRedirectUri();
  const request = new AuthRequest({
    clientId,
    redirectUri,
    scopes: [DRIVE_FILE_SCOPE],
    responseType: ResponseType.Code,
    usePKCE: true,
    extraParams: {
      access_type: "offline",
      prompt: "consent",
    },
  });

  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (result.type !== "success") {
    throw new Error(result.type === "cancel" ? "Google sign-in was cancelled." : "Google sign-in did not complete.");
  }

  const code = result.params.code;
  if (!code) {
    throw new Error("Google did not return an authorization code.");
  }

  const tokenResponse = await exchangeCodeAsync({
    clientId,
    code,
    redirectUri,
    extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
  }, GOOGLE_DISCOVERY);

  if (!tokenResponse.refreshToken) {
    throw new Error("Google did not return a refresh token. Reconnect and approve offline access, or revoke this app in your Google account and try again.");
  }

  const expiresAt = accessTokenExpiresAt(tokenResponse.expiresIn);
  const settings = appSettingsRepo(params.db);
  await settings.upsert("googleDriveOAuthClientId", clientId);
  await settings.upsert("googleDriveOAuthRedirectUri", redirectUri);
  await upsertTokenSettings(params.db, {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken,
    expiresAt,
  });

  return {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken,
    expiresAt,
  };
}

export async function refreshGoogleDriveAccessToken(params: {
  db: Db;
  clientId?: string | null;
  refreshToken?: string | null;
}) {
  const settings = appSettingsRepo(params.db);
  const clientId = params.clientId?.trim() || (await settings.getByKey<string>("googleDriveOAuthClientId"))?.trim();
  const refreshToken = params.refreshToken?.trim() || (await settings.getByKey<string>("googleDriveRefreshToken"))?.trim();

  if (!clientId) {
    throw new Error("Google OAuth client ID is required to refresh Drive access.");
  }
  if (!refreshToken) {
    throw new Error("Google Drive refresh token is missing. Connect Google Drive again.");
  }

  const tokenResponse = await refreshAsync({
    clientId,
    refreshToken,
    scopes: [DRIVE_FILE_SCOPE],
  }, GOOGLE_DISCOVERY);
  const expiresAt = accessTokenExpiresAt(tokenResponse.expiresIn);

  await upsertTokenSettings(params.db, {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken ?? refreshToken,
    expiresAt,
  });

  return {
    accessToken: tokenResponse.accessToken,
    expiresAt,
  };
}

export async function getFreshGoogleDriveAccessToken(db: Db) {
  const settings = appSettingsRepo(db);
  const accessToken = (await settings.getByKey<string>("googleDriveAccessToken"))?.trim();
  const refreshToken = (await settings.getByKey<string>("googleDriveRefreshToken"))?.trim();
  const expiresAt = await settings.getByKey<number>("googleDriveAccessTokenExpiresAt");

  if (accessToken && (!expiresAt || expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS)) {
    return accessToken;
  }

  if (refreshToken) {
    const refreshed = await refreshGoogleDriveAccessToken({ db, refreshToken });
    return refreshed.accessToken;
  }

  if (accessToken) {
    return accessToken;
  }

  throw new Error("Google Drive is not connected. Connect with Google or provide an access token.");
}

export async function disconnectGoogleDriveOAuth(db: Db) {
  const settings = appSettingsRepo(db);
  const refreshToken = (await settings.getByKey<string>("googleDriveRefreshToken"))?.trim();
  const clientId = (await settings.getByKey<string>("googleDriveOAuthClientId"))?.trim();

  if (refreshToken && clientId) {
    try {
      await revokeAsync({ token: refreshToken, clientId }, GOOGLE_DISCOVERY);
    } catch {
      // Local disconnect should still succeed if Google rejects revocation.
    }
  }

  await Promise.all([
    settings.upsert("googleDriveAccessToken", ""),
    settings.upsert("googleDriveRefreshToken", ""),
    settings.upsert("googleDriveAccessTokenExpiresAt", null),
  ]);
}
