import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canViewTicket, canModifyComment } from "@/lib/permissions";
import {
  handler,
  requireSession,
  parseBody,
  forbidden,
  notFound,
  json,
} from "@/lib/api";
import { LIMITS, trimmedString } from "@/lib/validation";
import { commentSelect } from "@/lib/ticket-query";

const editSchema = z.object({
  body: trimmedString(LIMITS.comment, "Comment"),
});

type Ctx = { params: Promise<{ id: string; commentId: string }> };

/**
 * Loads a comment and checks the caller may act on it. Comments are scoped to
 * their ticket so a valid comment id from another ticket cannot be edited by
 * someone who merely has access to this one.
 */
async function loadEditableComment(
  ticketId: string,
  commentId: string,
  user: { id: string; role: Parameters<typeof canViewTicket>[0] }
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      status: true,
      creatorId: true,
      managerId: true,
      ticketNumber: true,
    },
  });
  if (!ticket) throw notFound("That ticket does not exist.");
  if (!canViewTicket(user.role, user.id, ticket)) {
    throw forbidden("You do not have access to this ticket.");
  }

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, ticketId, deletedAt: null },
    select: { id: true, authorId: true, body: true },
  });
  if (!comment) throw notFound("That comment no longer exists.");

  if (!canModifyComment(user.role, user.id, comment)) {
    throw forbidden("You can only change your own comments.");
  }

  if (ticket.status === "ACKNOWLEDGED" && user.role !== "ADMIN") {
    throw forbidden(
      "This ticket has been acknowledged and is locked from further changes."
    );
  }

  return { ticket, comment };
}

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSession();
  const { id, commentId } = await ctx.params;
  const { comment } = await loadEditableComment(id, commentId, user);

  const data = await parseBody(req, editSchema);
  if (data.body === comment.body) {
    return json(await currentComment(commentId));
  }

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { body: data.body, editedAt: new Date() },
    select: commentSelect,
  });

  return json(updated);
});

export const DELETE = handler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSession();
  const { id, commentId } = await ctx.params;
  await loadEditableComment(id, commentId, user);

  // Soft delete: the comment leaves the thread but the audit trail survives.
  await prisma.$transaction(async (tx) => {
    await tx.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    await tx.ticketEvent.create({
      data: {
        type: "COMMENT_DELETED",
        newValue: "A comment was deleted",
        ticketId: id,
        userId: user.id,
      },
    });
  });

  return json({ success: true });
});

function currentComment(commentId: string) {
  return prisma.comment.findUniqueOrThrow({
    where: { id: commentId },
    select: commentSelect,
  });
}
