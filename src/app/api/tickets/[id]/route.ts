import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canViewTicket,
  canModifyTicket,
  canAcknowledgeTicket,
} from "@/lib/permissions";
import {
  handler,
  requireSession,
  parseBody,
  badRequest,
  forbidden,
  notFound,
  json,
} from "@/lib/api";
import { notify } from "@/lib/notify";
import { endOfDayUTC, startOfDayUTC, humanizeEnum } from "@/lib/format";
import {
  CATEGORIES,
  LIMITS,
  SEVERITIES,
  STATUSES,
  trimmedString,
  dateOnlyString,
} from "@/lib/validation";
import type { EventType, Prisma } from "@prisma/client";

const updateTicketSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    severity: z.enum(SEVERITIES).optional(),
    deadline: dateOnlyString.nullable().optional(),
    title: trimmedString(LIMITS.title, "Title").optional(),
    description: trimmedString(LIMITS.description, "Description").optional(),
    category: z.enum(CATEGORIES).optional(),
    dateOfOccurrence: dateOnlyString.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No changes were supplied.",
  });

const ticketDetailInclude = {
  creator: { select: { id: true, name: true, email: true, role: true } },
  manager: { select: { id: true, name: true, email: true, role: true } },
  events: {
    select: {
      id: true,
      type: true,
      oldValue: true,
      newValue: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  comments: {
    where: { deletedAt: null },
    select: {
      id: true,
      body: true,
      createdAt: true,
      editedAt: true,
      authorId: true,
      author: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.TicketInclude;

export const GET = handler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await ctx.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: ticketDetailInclude,
    });

    if (!ticket) throw notFound("That ticket does not exist.");
    if (!canViewTicket(user.role, user.id, ticket)) {
      throw forbidden("You do not have access to this ticket.");
    }

    return json(ticket);
  }
);

export const PATCH = handler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await ctx.params;

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw notFound("That ticket does not exist.");
    if (!canModifyTicket(user.role, user.id, ticket)) {
      throw forbidden("You do not have access to this ticket.");
    }

    if (ticket.status === "ACKNOWLEDGED") {
      throw forbidden(
        "This ticket has been acknowledged and is locked from further changes."
      );
    }

    const data = await parseBody(req, updateTicketSchema);

    if (data.status === "ACKNOWLEDGED") {
      if (!canAcknowledgeTicket(user.role)) {
        throw forbidden("Only admins can acknowledge tickets.");
      }
      if (ticket.status !== "CLOSED") {
        throw badRequest("Only closed tickets can be acknowledged.");
      }
    }

    if (data.dateOfOccurrence) {
      const occurred = startOfDayUTC(data.dateOfOccurrence);
      if (occurred.getTime() > Date.now()) {
        throw badRequest("The date of occurrence cannot be in the future.");
      }
    }

    const events: Prisma.TicketEventCreateManyInput[] = [];
    const push = (
      type: EventType,
      oldValue: string | null,
      newValue: string | null
    ) => events.push({ type, oldValue, newValue, ticketId: id, userId: user.id });

    const updateData: Prisma.TicketUpdateInput = {};

    if (data.status && data.status !== ticket.status) {
      updateData.status = data.status;
      push(
        data.status === "ACKNOWLEDGED" ? "ACKNOWLEDGED" : "STATUS_CHANGE",
        ticket.status,
        data.status
      );
    }

    // Severity used to be logged as STATUS_CHANGE, so the timeline could not
    // tell "OPEN -> CLOSED" apart from "LOW -> HIGH".
    if (data.severity && data.severity !== ticket.severity) {
      updateData.severity = data.severity;
      push("SEVERITY_CHANGE", ticket.severity, data.severity);
    }

    if (data.deadline !== undefined) {
      const next = data.deadline ? endOfDayUTC(data.deadline) : null;
      const changed =
        (next?.getTime() ?? null) !== (ticket.deadline?.getTime() ?? null);
      if (changed) {
        updateData.deadline = next;
        push(
          "DEADLINE_CHANGE",
          ticket.deadline?.toISOString().split("T")[0] ?? "none",
          next?.toISOString().split("T")[0] ?? "none"
        );
      }
    }

    if (data.title !== undefined && data.title !== ticket.title) {
      updateData.title = data.title;
      push("EDITED", "title", data.title);
    }

    if (
      data.description !== undefined &&
      data.description !== ticket.description
    ) {
      updateData.description = data.description;
      push("EDITED", "description", "description updated");
    }

    if (data.category && data.category !== ticket.category) {
      updateData.category = data.category;
      push("EDITED", humanizeEnum(ticket.category), humanizeEnum(data.category));
    }

    if (data.dateOfOccurrence !== undefined) {
      const next = data.dateOfOccurrence
        ? startOfDayUTC(data.dateOfOccurrence)
        : null;
      const changed =
        (next?.getTime() ?? null) !==
        (ticket.dateOfOccurrence?.getTime() ?? null);
      if (changed) {
        updateData.dateOfOccurrence = next;
        push(
          "EDITED",
          ticket.dateOfOccurrence?.toISOString().split("T")[0] ?? "none",
          next?.toISOString().split("T")[0] ?? "none"
        );
      }
    }

    if (Object.keys(updateData).length === 0) {
      return json({ ...ticket, unchanged: true });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.ticket.update({
        where: { id },
        data: updateData,
        include: ticketDetailInclude,
      });

      if (events.length > 0) {
        await tx.ticketEvent.createMany({ data: events });
      }

      if (updateData.status) {
        await notify(tx, {
          recipientIds: [ticket.creatorId, ticket.managerId],
          actorId: user.id,
          message: `Ticket #${ticket.ticketNumber} is now ${humanizeEnum(
            String(updateData.status)
          )}`,
          link: `/tickets/${ticket.id}`,
        });
      }

      return result;
    });

    return json(updated);
  }
);

/** Admin-only hard delete, used for spam or duplicates created in error. */
export const DELETE = handler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    if (user.role !== "ADMIN") {
      throw forbidden("Only admins can delete tickets.");
    }

    const { id } = await ctx.params;
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, ticketNumber: true },
    });
    if (!ticket) throw notFound("That ticket does not exist.");

    // Comments and events cascade via the schema's onDelete rules.
    await prisma.ticket.delete({ where: { id } });

    return json({ success: true, ticketNumber: ticket.ticketNumber });
  }
);
