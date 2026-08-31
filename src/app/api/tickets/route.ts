import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, requireSession, parseBody, badRequest, json } from "@/lib/api";
import { notify } from "@/lib/notify";
import { endOfDayUTC, startOfDayUTC } from "@/lib/format";
import {
  CATEGORIES,
  LIMITS,
  SEVERITIES,
  parsePagination,
  trimmedString,
  dateOnlyString,
} from "@/lib/validation";
import {
  ticketListSelect,
  buildTicketFilter,
  buildTicketOrderBy,
} from "@/lib/ticket-query";

const createTicketSchema = z.object({
  title: trimmedString(LIMITS.title, "Title"),
  description: trimmedString(LIMITS.description, "Description"),
  category: z.enum(CATEGORIES),
  severity: z.enum(SEVERITIES).optional(),
  managerId: z.string().min(1).optional(),
  dateOfOccurrence: dateOnlyString.optional(),
  deadline: dateOnlyString.optional(),
});

export const GET = handler(async (req: NextRequest) => {
  const user = await requireSession();
  const params = req.nextUrl.searchParams;

  const where = buildTicketFilter(params, user.role, user.id);
  const { page, limit, skip } = parsePagination(params);

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      select: ticketListSelect,
      orderBy: buildTicketOrderBy(params),
      skip,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  return json(
    { tickets, total, page, limit, totalPages: Math.ceil(total / limit) },
    {
      headers: {
        "Cache-Control": "private, max-age=5, stale-while-revalidate=15",
      },
    }
  );
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireSession();
  const data = await parseBody(req, createTicketSchema);

  // Reject a manager id that does not resolve to an active user, rather than
  // letting it surface as a foreign-key 500.
  if (data.managerId) {
    const manager = await prisma.user.findFirst({
      where: { id: data.managerId, isActive: true },
      select: { id: true },
    });
    if (!manager) {
      throw badRequest("The selected assignee is not an active user.");
    }
  }

  if (data.dateOfOccurrence) {
    const occurred = startOfDayUTC(data.dateOfOccurrence);
    if (occurred.getTime() > Date.now()) {
      throw badRequest("The date of occurrence cannot be in the future.");
    }
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        severity: data.severity ?? "MEDIUM",
        creatorId: user.id,
        managerId: data.managerId ?? null,
        dateOfOccurrence: data.dateOfOccurrence
          ? startOfDayUTC(data.dateOfOccurrence)
          : null,
        // Deadlines are end-of-day so "due today" is not instantly overdue.
        deadline: data.deadline ? endOfDayUTC(data.deadline) : null,
      },
      select: { ...ticketListSelect, description: true },
    });

    await tx.ticketEvent.create({
      data: {
        type: "CREATED",
        newValue: `Ticket #${created.ticketNumber} created`,
        ticketId: created.id,
        userId: user.id,
      },
    });

    await notify(tx, {
      recipientIds: [created.manager?.id],
      actorId: user.id,
      message: `You have been assigned ticket #${created.ticketNumber}: ${created.title}`,
      link: `/tickets/${created.id}`,
    });

    return created;
  });

  return NextResponse.json(ticket, { status: 201 });
});
