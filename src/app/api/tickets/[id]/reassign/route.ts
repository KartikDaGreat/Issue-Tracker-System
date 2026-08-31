import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canReassignTicket } from "@/lib/permissions";
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

const reassignSchema = z.object({
  managerId: z.string().min(1, "Choose someone to assign this to."),
});

export const PATCH = handler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await ctx.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { manager: { select: { id: true, name: true } } },
    });

    if (!ticket) throw notFound("That ticket does not exist.");

    if (ticket.status === "ACKNOWLEDGED") {
      throw forbidden(
        "This ticket has been acknowledged and is locked from further changes."
      );
    }

    if (!canReassignTicket(user.role, user.id, ticket)) {
      throw forbidden("You cannot reassign this ticket.");
    }

    const data = await parseBody(req, reassignSchema);

    if (data.managerId === ticket.managerId) {
      return json(ticket);
    }

    const newManager = await prisma.user.findFirst({
      where: { id: data.managerId, isActive: true },
      select: { id: true, name: true },
    });

    if (!newManager) {
      throw badRequest("The selected assignee is not an active user.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.ticket.update({
        where: { id },
        data: { managerId: newManager.id },
        include: {
          creator: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true } },
        },
      });

      await tx.ticketEvent.create({
        data: {
          type: "REASSIGNED",
          oldValue: ticket.manager?.name ?? "Unassigned",
          newValue: newManager.name,
          ticketId: id,
          userId: user.id,
        },
      });

      await notify(tx, {
        recipientIds: [newManager.id],
        actorId: user.id,
        message: `You have been assigned ticket #${ticket.ticketNumber}: ${ticket.title}`,
        link: `/tickets/${ticket.id}`,
      });

      // The previous owner should know it left their queue.
      await notify(tx, {
        recipientIds: [ticket.managerId],
        actorId: user.id,
        message: `Ticket #${ticket.ticketNumber} was reassigned to ${newManager.name}`,
        link: `/tickets/${ticket.id}`,
      });

      return result;
    });

    return json(updated);
  }
);
