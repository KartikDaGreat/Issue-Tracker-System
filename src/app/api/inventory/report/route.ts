import { NextRequest, NextResponse } from "next/server";
import { canViewReports } from "@/lib/permissions";
import { handler, requireSession, forbidden, badRequest } from "@/lib/api";
import {
  gatherReportData,
  buildReportPdf,
  defaultReportRange,
  reportFileName,
  type ReportOptions,
} from "@/lib/report";
import { startOfDayUTC, endOfDayUTC } from "@/lib/format";

/** Reads an optional `from`/`to` window, falling back to the last six months. */
function parseRange(params: URLSearchParams): ReportOptions {
  const fromRaw = params.get("from");
  const toRaw = params.get("to");
  if (!fromRaw && !toRaw) return defaultReportRange();

  const fallback = defaultReportRange();
  const from = fromRaw ? startOfDayUTC(fromRaw) : fallback.from;
  const to = toRaw ? endOfDayUTC(toRaw) : fallback.to;

  if (from > to) {
    throw badRequest("The start of the range must come before the end.");
  }
  return { from, to };
}

export const GET = handler(async (req: NextRequest) => {
  const user = await requireSession();
  // Widened from admin-only: the managers who maintain stock could not read
  // the report about the stock they maintain.
  if (!canViewReports(user.role)) throw forbidden();

  const data = await gatherReportData(parseRange(req.nextUrl.searchParams));
  const pdf = buildReportPdf(data);

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${reportFileName()}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
