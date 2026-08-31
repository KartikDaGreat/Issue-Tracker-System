/**
 * Thin Google Drive REST client.
 *
 * Access tokens are cached in module scope: every Drive call used to perform a
 * full OAuth refresh round-trip first, even though the tokens are valid for an
 * hour.
 */

export interface DriveFile {
  id: string;
  name: string;
  createdTime: string;
  mimeType: string;
  parents?: string[];
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;
let inFlight: Promise<string> | null = null;

/** Refresh a minute early so a token cannot expire mid-request. */
const EXPIRY_SKEW_MS = 60_000;

export class DriveError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "DriveError";
    this.status = status;
  }
}

export function isDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
  );
}

async function refreshAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new DriveError("Google Drive credentials are not configured.", 503);
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new DriveError(
      data.error_description
        ? `Google rejected the refresh token: ${data.error_description}`
        : "Could not refresh the Google access token.",
      502
    );
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - EXPIRY_SKEW_MS,
  };

  return cachedToken.token;
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  // Collapse concurrent refreshes into a single request.
  if (!inFlight) {
    inFlight = refreshAccessToken().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Drops the cached token so the next call re-authenticates. */
export function invalidateAccessToken() {
  cachedToken = null;
}

async function driveFetch(
  url: string,
  init: RequestInit = {},
  retryOnAuthFailure = true
): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });

  // A cached token can be revoked server-side; retry once with a fresh one.
  if (res.status === 401 && retryOnAuthFailure) {
    invalidateAccessToken();
    return driveFetch(url, init, false);
  }

  return res;
}

async function assertOk(res: Response, action: string): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => "");
  throw new DriveError(
    `Google Drive ${action} failed (${res.status}). ${body.slice(0, 300)}`,
    res.status === 404 ? 404 : 502
  );
}

function buildMultipartBody(
  metadata: Record<string, unknown>,
  fileBytes: Uint8Array,
  mimeType: string,
  boundary: string
): Uint8Array {
  const encoder = new TextEncoder();
  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
  );
  const suffix = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(prefix.length + fileBytes.length + suffix.length);
  body.set(prefix, 0);
  body.set(fileBytes, prefix.length);
  body.set(suffix, prefix.length + fileBytes.length);
  return body;
}

export async function uploadFileToDrive(
  fileBytes: Uint8Array,
  fileName: string,
  mimeType: string,
  folderId: string
): Promise<{ id: string; name: string; webViewLink: string }> {
  const boundary = `boundary_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const body = buildMultipartBody(
    { name: fileName, parents: [folderId], mimeType },
    fileBytes,
    mimeType,
    boundary
  );

  const res = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: body as unknown as BodyInit,
    }
  );

  await assertOk(res, "upload");
  return res.json();
}

/** Escapes a value for use inside a Drive `q` query string literal. */
function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Lists a folder's contents, following pagination rather than stopping at 100. */
export async function listFilesInFolder(
  folderId: string,
  maxFiles = 500
): Promise<DriveFile[]> {
  const q = encodeURIComponent(
    `'${escapeQueryValue(folderId)}' in parents and trashed = false`
  );

  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const url =
      `https://www.googleapis.com/drive/v3/files?q=${q}` +
      `&fields=nextPageToken,files(id,name,createdTime,mimeType)` +
      `&orderBy=createdTime desc&pageSize=100` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");

    const res = await driveFetch(url);
    await assertOk(res, "list");

    const data = (await res.json()) as {
      files?: DriveFile[];
      nextPageToken?: string;
    };

    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken && files.length < maxFiles);

  return files.slice(0, maxFiles);
}

export async function getFileMetadata(fileId: string): Promise<DriveFile> {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?fields=id,name,createdTime,mimeType,parents`
  );
  await assertOk(res, "metadata lookup");
  return res.json();
}

/**
 * Confirms a file actually lives in the expected folder.
 *
 * Without this, an endpoint that takes a Drive file id from the URL will serve
 * *any* file the connected account can reach, not just the ones the feature
 * owns.
 */
export async function assertFileInFolder(
  fileId: string,
  folderId: string
): Promise<DriveFile> {
  const file = await getFileMetadata(fileId);
  if (!file.parents?.includes(folderId)) {
    throw new DriveError("That file is not available here.", 404);
  }
  return file;
}

export async function downloadFileFromDrive(
  fileId: string
): Promise<ArrayBuffer> {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?alt=media`
  );
  await assertOk(res, "download");
  return res.arrayBuffer();
}

export async function createDriveFolder(
  folderName: string,
  parentId: string
): Promise<{ id: string; name: string }> {
  const res = await driveFetch(
    "https://www.googleapis.com/drive/v3/files?fields=id,name",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    }
  );

  await assertOk(res, "folder creation");
  return res.json();
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

export async function getOrCreateSubfolder(
  parentId: string,
  name: string
): Promise<string> {
  const files = await listFilesInFolder(parentId);
  const existing = files.find(
    (f) => f.name === name && f.mimeType === FOLDER_MIME
  );
  if (existing) return existing.id;

  const folder = await createDriveFolder(name, parentId);
  return folder.id;
}
