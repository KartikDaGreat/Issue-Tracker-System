import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import {
  handler,
  requireSession,
  parseBody,
  badRequest,
  forbidden,
  notFound,
  json,
} from "@/lib/api";
import {
  BCRYPT_ROUNDS,
  LIMITS,
  ROLES,
  passwordString,
  trimmedString,
} from "@/lib/validation";
import type { Prisma } from "@prisma/client";

const updateUserSchema = z
  .object({
    name: trimmedString(LIMITS.name, "Name").optional(),
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
    password: passwordString.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No changes were supplied.",
  });

type Ctx = { params: Promise<{ id: string }> };

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/**
 * Guards against an admin locking everybody out.
 *
 * PATCH previously had no self-protection at all, so an admin could demote or
 * deactivate themselves — or the last remaining admin — and leave the system
 * with no one able to manage users.
 */
async function assertNotLastAdmin(
  targetId: string,
  change: { role?: string; isActive?: boolean }
) {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { role: true, isActive: true },
  });
  if (!target) return;

  const losesAdmin =
    target.role === "ADMIN" &&
    target.isActive &&
    ((change.role !== undefined && change.role !== "ADMIN") ||
      change.isActive === false);

  if (!losesAdmin) return;

  const remaining = await prisma.user.count({
    where: { role: "ADMIN", isActive: true, id: { not: targetId } },
  });

  if (remaining === 0) {
    throw badRequest(
      "This is the last active admin. Promote another admin before changing this account."
    );
  }
}

export const GET = handler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSession();
  if (!canManageUsers(user.role)) throw forbidden();

  const { id } = await ctx.params;
  const found = await prisma.user.findUnique({
    where: { id },
    select: {
      ...userSelect,
      _count: { select: { createdTickets: true, managedTickets: true } },
    },
  });

  if (!found) throw notFound("That user does not exist.");
  return json(found);
});

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSession();
  if (!canManageUsers(user.role)) throw forbidden();

  const { id } = await ctx.params;
  const data = await parseBody(req, updateUserSchema);

  if (id === user.id) {
    if (data.role !== undefined && data.role !== "ADMIN") {
      throw badRequest("You cannot remove your own admin role.");
    }
    if (data.isActive === false) {
      throw badRequest("You cannot deactivate your own account.");
    }
  }

  await assertNotLastAdmin(id, data);

  const updateData: Prisma.UserUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.password !== undefined) {
    updateData.hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: userSelect,
  });

  return json(updated);
});

/**
 * Deactivates a user, or hard-deletes one who has left no trace.
 *
 * The old behaviour deleted the user's comments and ticket events outright,
 * which quietly destroyed the audit trail on tickets other people still rely
 * on. Anyone with history is now deactivated instead: they can no longer sign
 * in, but the record of what they did survives.
 */
export const DELETE = handler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSession();
  if (!canManageUsers(user.role)) throw forbidden();

  const { id } = await ctx.params;
  if (id === user.id) throw badRequest("You cannot delete your own account.");

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, isActive: true, role: true },
  });
  if (!target) throw notFound("That user does not exist.");

  await assertNotLastAdmin(id, { isActive: false });

  const [tickets, comments, events, inventoryItems, inventoryLogs] =
    await Promise.all([
      prisma.ticket.count({
        where: { OR: [{ creatorId: id }, { managerId: id }] },
      }),
      prisma.comment.count({ where: { authorId: id } }),
      prisma.ticketEvent.count({ where: { userId: id } }),
      prisma.inventoryItem.count({ where: { createdById: id } }),
      prisma.inventoryLog.count({ where: { loggedById: id } }),
    ]);

  const hasHistory =
    tickets + comments + events + inventoryItems + inventoryLogs > 0;

  if (hasHistory) {
    if (!target.isActive) {
      return json({
        success: true,
        deactivated: true,
        alreadyInactive: true,
        message: "That user is already deactivated.",
      });
    }

    await prisma.user.update({ where: { id }, data: { isActive: false } });

    return json({
      success: true,
      deactivated: true,
      message:
        "This user has activity on record, so their account was deactivated instead of deleted. Their history stays intact and they can no longer sign in.",
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { userId: id } });
    await tx.user.delete({ where: { id } });
  });

  return json({ success: true, deactivated: false, message: "User deleted." });
});
