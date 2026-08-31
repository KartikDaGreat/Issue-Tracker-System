import { NextRequest } from "next/server";
import { canViewReports } from "@/lib/permissions";
import { handler, requireSession, forbidden, json } from "@/lib/api";
import {
  gatherReportData,
  buildReportPdf,
  defaultReportRange,
  reportFileName,
} from "@/lib/report";
import { uploadFileToDrive, isDriveConfigured, DriveError } from "@/lib/google-drive";
import { ApiError } from "@/lib/api";
import { startOfDayUTC, endOfDayUTC } from "@/lib/format";

/**
 * Archives the inventory report to Google Drive.
 *
 * This endpoint used to read the PDF from the request body while the browser
 * sent no body at all, so it failed with "No PDF data received" every single
 * time. It now builds the document server-side from the same code path as the
 * download endpoint, which also means the archived file is guaranteed to
 * reflect real database state rather than whatever bytes a client posted.
 */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireSession();
  if (!canViewReports(user.role)) throw forbidden();

  const folderId = process.env.GOOGLE_DRIVE_REPORTS_FOLDER_ID;
  if (!folderId) {
    throw new ApiError(
      503,
      "The Google Drive reports folder is not configured on the server."
    );
  }
  if (!isDriveConfigured()) {
    throw new ApiError(503, "Google Drive credentials are not configured.");
  }

  const params = req.nextUrl.searchParams;
  const fallback = defaultReportRange();
  const from = params.get("from") ? startOfDayUTC(params.get("from")!) : fallback.from;
  const to = params.get("to") ? endOfDayUTC(params.get("to")!) : fallback.to;

  const data = await gatherReportData({ from, to });
  const pdf = buildReportPdf(data);

  try {
    const file = await uploadFileToDrive(
      new Uint8Array(pdf),
      reportFileName(),
      "application/pdf",
      folderId
    );
    return json({ name: file.name, link: file.webViewLink });
  } catch (err) {
    if (err instanceof DriveError) throw new ApiError(err.status, err.message);
    throw err;
  }
});
