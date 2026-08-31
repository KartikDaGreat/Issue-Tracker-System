import { NextRequest } from "next/server";
import {
  handler,
  requireRole,
  badRequest,
  ApiError,
  json,
} from "@/lib/api";
import {
  getAccessToken,
  getOrCreateSubfolder,
  listFilesInFolder,
  uploadFileToDrive,
  isDriveConfigured,
  DriveError,
} from "@/lib/google-drive";

/**
 * Student performance workbooks, stored in Drive under a per-academic-year
 * folder.
 */

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const SPREADSHEET_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
]);

const SPREADSHEET_EXTENSIONS = [".xlsx", ".xls", ".csv"];

function hasSpreadsheetExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return SPREADSHEET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Academic year runs June to May: 2026-08 falls in "2026-2027". */
function getAcademicYear(now = new Date()): string {
  const year = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

/**
 * Strips path separators and control characters from a user-supplied label
 * before it becomes a Drive filename.
 */
function sanitiseLabel(label: string): string {
  const cleaned = label
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return cleaned || "performance";
}

function requireFolder(): string {
  const folderId = process.env.GOOGLE_DRIVE_PERFORMANCE_FOLDER_ID;
  if (!folderId) {
    throw new ApiError(
      503,
      "The Google Drive performance folder is not configured on the server."
    );
  }
  if (!isDriveConfigured()) {
    throw new ApiError(503, "Google Drive credentials are not configured.");
  }
  return folderId;
}

async function withDriveErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof DriveError) throw new ApiError(err.status, err.message);
    throw err;
  }
}

export const GET = handler(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const rootFolderId = requireFolder();

  const year = req.nextUrl.searchParams.get("year") ?? getAcademicYear();

  return withDriveErrors(async () => {
    await getAccessToken();
    const yearFolderId = await getOrCreateSubfolder(rootFolderId, year);
    const files = await listFilesInFolder(yearFolderId);

    const spreadsheets = files.filter(
      (f) =>
        SPREADSHEET_MIME_TYPES.has(f.mimeType) || hasSpreadsheetExtension(f.name)
    );

    return json({
      academicYear: year,
      files: spreadsheets.map((f) => ({
        id: f.id,
        name: f.name,
        createdTime: f.createdTime,
      })),
    });
  });
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireRole("ADMIN");
  const rootFolderId = requireFolder();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    throw badRequest("The upload could not be read.");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) throw badRequest("Choose a file to upload.");

  // None of this was checked before: any file of any size was accepted and
  // relabelled ".xlsx".
  if (file.size === 0) throw badRequest("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw badRequest(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${
        MAX_UPLOAD_BYTES / 1024 / 1024
      } MB.`
    );
  }

  if (
    !SPREADSHEET_MIME_TYPES.has(file.type) &&
    !hasSpreadsheetExtension(file.name)
  ) {
    throw badRequest("Upload an Excel (.xlsx, .xls) or CSV file.");
  }

  const rawLabel = formData.get("label");
  const extension = file.name.toLowerCase().endsWith(".csv") ? ".csv" : ".xlsx";
  const fileName =
    typeof rawLabel === "string" && rawLabel.trim()
      ? `${sanitiseLabel(rawLabel)}${extension}`
      : sanitiseLabel(file.name.replace(/\.[^.]+$/, "")) + extension;

  const mimeType =
    extension === ".csv"
      ? "text/csv"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const bytes = new Uint8Array(await file.arrayBuffer());

  return withDriveErrors(async () => {
    const yearFolderId = await getOrCreateSubfolder(
      rootFolderId,
      getAcademicYear()
    );
    const uploaded = await uploadFileToDrive(
      bytes,
      fileName,
      mimeType,
      yearFolderId
    );

    // Nothing is stored in Postgres for these files, so leave a trace of who
    // uploaded what.
    console.info(
      `[performance] ${user.email} uploaded "${fileName}" (${file.size} bytes)`
    );

    return json({ id: uploaded.id, name: uploaded.name });
  });
});
