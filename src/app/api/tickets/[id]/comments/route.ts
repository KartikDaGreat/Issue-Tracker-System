import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canViewTicket } from "@/lib/permissions";
import {
  handler,
  requireSession,
  parseBody,
  forbidden,
  notFound,
  json,
} from "@/lib/api";
import { notify } from "@/lib/notify";
import { LIMITS, trimmedString } from "@/lib/validation";
import { commentSelect } from "@/lib/ticket-query";

const commentSchema = z.object({
  body: trimmedString(LIMITS.comment, "Comment"),
});

export const GET = handler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await ctx.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, creatorId: true, managerId: true },
    });
    if (!ticket) throw notFound("That ticket does not exist.");
    if (!canViewTicket(user.role, user.id, ticket)) {
      throw forbidden("You do not have access to this ticket.");
    }

    const comments = await prisma.comment.findMany({
      where: { ticketId: id, deletedAt: null },
      select: commentSelect,
      orderBy: { createdAt: "asc" },
    });

    return json(comments);
  }
);

export const POST = handler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await ctx.params;

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw notFound("That ticket does not exist.");
    if (!canViewTicket(user.role, user.id, ticket)) {
      throw forbidden("You do not have access to this ticket.");
    }

    if (ticket.status === "ACKNOWLEDGED" && user.role !== "ADMIN") {
      throw forbidden(
        "This ticket has been acknowledged; only admins can add comments."
      );
    }

    const data = await parseBody(req, commentSchema);

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: { body: data.body, ticketId: id, authorId: user.id },
        select: commentSelect,
      });

      await tx.ticketEvent.create({
        data: {
          type: "COMMENT",
          newValue: data.body.slice(0, 100),
          ticketId: id,
          userId: user.id,
        },
      });

      await notify(tx, {
        recipientIds: [ticket.creatorId, ticket.managerId],
        actorId: user.id,
        message: `New comment on ticket #${ticket.ticketNumber} by ${user.name}`,
        link: `/tickets/${ticket.id}`,
      });

      return created;
    });

    return NextResponse.json(comment, { status: 201 });
  }
);
