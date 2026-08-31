import { NextRequest, NextResponse } from "next/server";
import { handler, requireRole, ApiError, notFound } from "@/lib/api";
import {
  assertFileInFolder,
  downloadFileFromDrive,
  listFilesInFolder,
  isDriveConfigured,
  DriveError,
  type DriveFile,
} from "@/lib/google-drive";

/**
 * Streams one performance workbook back to an admin.
 *
 * The file id arrives from the URL, so it is verified to actually live inside
 * one of the performance year folders first. Without that check this endpoint
 * would serve *any* file the connected Google account can reach, not just the
 * ones this feature owns.
 */

const FOLDER_MIME = "application/vnd.google-apps.folder";

const CONTENT_TYPES: Record<string, string> = {
  ".csv": "text/csv",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function contentTypeFor(name: string): string {
  const match = Object.keys(CONTENT_TYPES).find((ext) =>
    name.toLowerCase().endsWith(ext)
  );
  return (
    (match && CONTENT_TYPES[match]) ||
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

/** Builds a Content-Disposition value that survives non-ASCII filenames. */
function dispositionFor(name: string): string {
  const ascii = name.replace(/[^A-Za-z0-9._ -]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export const GET = handler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    await requireRole("ADMIN");

    const rootFolderId = process.env.GOOGLE_DRIVE_PERFORMANCE_FOLDER_ID;
    if (!rootFolderId || !isDriveConfigured()) {
      throw new ApiError(503, "Google Drive is not configured on the server.");
    }

    const { id } = await ctx.params;

    try {
      const yearFolders = (await listFilesInFolder(rootFolderId)).filter(
        (f) => f.mimeType === FOLDER_MIME
      );

      let file: DriveFile | null = null;
      for (const folder of yearFolders) {
        try {
          file = await assertFileInFolder(id, folder.id);
          break;
        } catch (err) {
          // Not in this year's folder — keep looking. Anything that is not a
          // scoping miss should still surface.
          if (!(err instanceof DriveError) || err.status !== 404) throw err;
        }
      }

      if (!file) throw notFound("That file is not available here.");

      const buffer = await downloadFileFromDrive(id);

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentTypeFor(file.name),
          "Content-Disposition": dispositionFor(file.name),
          "Cache-Control": "private, no-store",
        },
      });
    } catch (err) {
      if (err instanceof DriveError) throw new ApiError(err.status, err.message);
      throw err;
    }
  }
);
