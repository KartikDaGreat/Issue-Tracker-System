import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canModifyTicket } from "@/lib/permissions";
import {
  handler,
  requireSession,
  parseBody,
  badRequest,
  json,
} from "@/lib/api";
import { notify } from "@/lib/notify";
import { humanizeEnum } from "@/lib/format";
import { SEVERITIES, STATUSES } from "@/lib/validation";
import type { Prisma, EventType } from "@prisma/client";

/**
 * Bulk triage: apply one change to many tickets at once.
 *
 * Each ticket is permission-checked individually and skipped (not failed) when
 * the caller may not touch it, so a partial selection still does useful work.
 * The response reports exactly what was applied and what was skipped.
 */

const MAX_BULK = 100;

const bulkSchema = z.object({
  ticketIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one ticket.")
    .max(MAX_BULK, `You can update at most ${MAX_BULK} tickets at once.`),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("status"), value: z.enum(STATUSES) }),
    z.object({ type: z.literal("severity"), value: z.enum(SEVERITIES) }),
    z.object({ type: z.literal("assign"), value: z.string().min(1) }),
  ]),
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireSession();
  const { ticketIds, action } = await parseBody(req, bulkSchema);

  if (action.type === "status" && action.value === "ACKNOWLEDGED") {
    throw badRequest(
      "Tickets must be acknowledged individually from the admin screen."
    );
  }

  const uniqueIds = Array.from(new Set(ticketIds));

  const tickets = await prisma.ticket.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      ticketNumber: true,
      status: true,
      severity: true,
      creatorId: true,
      managerId: true,
    },
  });

  let assignee: { id: string; name: string } | null = null;
  if (action.type === "assign") {
    assignee = await prisma.user.findFirst({
      where: { id: action.value, isActive: true },
      select: { id: true, name: true },
    });
    if (!assignee) {
      throw badRequest("The selected assignee is not an active user.");
    }
  }

  const skipped: { ticketNumber: number; reason: string }[] = [];
  const applicable: typeof tickets = [];

  for (const ticket of tickets) {
    if (ticket.status === "ACKNOWLEDGED") {
      skipped.push({
        ticketNumber: ticket.ticketNumber,
        reason: "acknowledged and locked",
      });
      continue;
    }

    if (!canModifyTicket(user.role, user.id, ticket)) {
      skipped.push({
        ticketNumber: ticket.ticketNumber,
        reason: "you cannot change this ticket",
      });
      continue;
    }

    applicable.push(ticket);
  }

  if (applicable.length === 0) {
    return json({ updated: 0, skipped });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const events: Prisma.TicketEventCreateManyInput[] = [];
    let changed = 0;

    for (const ticket of applicable) {
      const data: Prisma.TicketUpdateInput = {};
      let eventType: EventType = "STATUS_CHANGE";
      let oldValue = "";
      let newValue = "";

      if (action.type === "status") {
        if (ticket.status === action.value) continue;
        data.status = action.value;
        eventType = "STATUS_CHANGE";
        oldValue = ticket.status;
        newValue = action.value;
      } else if (action.type === "severity") {
        if (ticket.severity === action.value) continue;
        data.severity = action.value;
        eventType = "SEVERITY_CHANGE";
        oldValue = ticket.severity;
        newValue = action.value;
      } else if (assignee) {
        if (ticket.managerId === assignee.id) continue;
        data.manager = { connect: { id: assignee.id } };
        eventType = "REASSIGNED";
        oldValue = "previous assignee";
        newValue = assignee.name;
      }

      await tx.ticket.update({ where: { id: ticket.id }, data });
      changed += 1;

      events.push({
        type: eventType,
        oldValue,
        newValue,
        ticketId: ticket.id,
        userId: user.id,
      });

      const message =
        action.type === "assign" && assignee
          ? `You have been assigned ticket #${ticket.ticketNumber}`
          : `Ticket #${ticket.ticketNumber} is now ${humanizeEnum(
              String(action.value)
            )}`;

      await notify(tx, {
        recipientIds:
          action.type === "assign" && assignee
            ? [assignee.id]
            : [ticket.creatorId, ticket.managerId],
        actorId: user.id,
        message,
        link: `/tickets/${ticket.id}`,
      });
    }

    if (events.length > 0) {
      await tx.ticketEvent.createMany({ data: events });
    }

    return changed;
  });

  return json({
    updated,
    unchanged: applicable.length - updated,
    skipped,
  });
});
