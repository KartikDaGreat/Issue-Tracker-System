import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, requireSession } from "@/lib/api";
import { humanizeEnum } from "@/lib/format";
import { buildTicketFilter, buildTicketOrderBy } from "@/lib/ticket-query";

/**
 * CSV export of the current filter selection.
 *
 * Reuses the list endpoint's filter builder so the export always matches what
 * the user is looking at, and stays role-scoped.
 */

const MAX_EXPORT_ROWS = 5000;

/**
 * Escapes a CSV field. The leading-quote guard stops spreadsheet software from
 * evaluating a value beginning with =, +, - or @ as a formula.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

function isoDate(value: Date | null): string {
  return value ? value.toISOString().split("T")[0] : "";
}

export const GET = handler(async (req: NextRequest) => {
  const user = await requireSession();
  const params = req.nextUrl.searchParams;

  const tickets = await prisma.ticket.findMany({
    where: buildTicketFilter(params, user.role, user.id),
    orderBy: buildTicketOrderBy(params),
    take: MAX_EXPORT_ROWS,
    select: {
      ticketNumber: true,
      title: true,
      description: true,
      category: true,
      severity: true,
      status: true,
      dateOfOccurrence: true,
      deadline: true,
      createdAt: true,
      updatedAt: true,
      creator: { select: { name: true } },
      manager: { select: { name: true } },
      _count: { select: { comments: true } },
    },
  });

  const header = [
    "Ticket",
    "Title",
    "Description",
    "Category",
    "Severity",
    "Status",
    "Reported by",
    "Assigned to",
    "Occurred on",
    "Deadline",
    "Created",
    "Last updated",
    "Comments",
  ];

  const lines = [
    csvRow(header),
    ...tickets.map((t) =>
      csvRow([
        t.ticketNumber,
        t.title,
        t.description,
        humanizeEnum(t.category),
        t.severity,
        humanizeEnum(t.status),
        t.creator.name,
        t.manager?.name ?? "Unassigned",
        isoDate(t.dateOfOccurrence),
        isoDate(t.deadline),
        t.createdAt.toISOString(),
        t.updatedAt.toISOString(),
        t._count.comments,
      ])
    ),
  ];

  // A BOM makes Excel read the file as UTF-8 rather than the system codepage.
  const body = `﻿${lines.join("\r\n")}\r\n`;
  const fileName = `tickets-${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
});
