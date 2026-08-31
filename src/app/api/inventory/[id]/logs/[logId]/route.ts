import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAccessInventory, canVoidInventoryLog } from "@/lib/permissions";
import {
  handler,
  requireSession,
  parseBody,
  badRequest,
  forbidden,
  notFound,
  json,
} from "@/lib/api";
import { getStockForItem, logDelta } from "@/lib/inventory";
import { LIMITS, trimmedString } from "@/lib/validation";

/**
 * Voids a stock movement.
 *
 * Log entries used to be permanent with no correction path at all, so a
 * mistyped quantity silently poisoned an item's stock forever. Voiding keeps
 * the original row (with who voided it and why) but excludes it from every
 * stock calculation.
 */

const voidSchema = z.object({
  reason: trimmedString(LIMITS.logDetails, "Reason"),
});

type Ctx = { params: Promise<{ id: string; logId: string }> };

export const POST = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSession();
  if (!canAccessInventory(user.role)) throw forbidden();
  if (!canVoidInventoryLog(user.role)) {
    throw forbidden("Only admins can void a stock entry.");
  }

  const { id, logId } = await ctx.params;
  const { reason } = await parseBody(req, voidSchema);

  const log = await prisma.inventoryLog.findFirst({
    where: { id: logId, itemId: id },
    select: {
      id: true,
      action: true,
      quantity: true,
      voidedAt: true,
      item: { select: { name: true, unit: true } },
    },
  });

  if (!log) throw notFound("That stock entry does not exist.");
  if (log.voidedAt) throw badRequest("That entry has already been voided.");

  const updated = await prisma.$transaction(async (tx) => {
    // Voiding a purchase removes stock that later usage may already depend on.
    // Reject the void rather than letting the item fall to a negative balance.
    if (log.action === "PURCHASED") {
      const stock = await getStockForItem(tx, id);
      const after = stock - log.quantity;
      if (after < 0) {
        throw badRequest(
          `Voiding this purchase would leave ${log.item.name} at ${after} ${log.item.unit}. Void the usage entries that depend on it first.`
        );
      }
    }

    const result = await tx.inventoryLog.update({
      where: { id: logId },
      data: {
        voidedAt: new Date(),
        voidedById: user.id,
        voidReason: reason,
      },
      select: {
        id: true,
        action: true,
        quantity: true,
        voidedAt: true,
        voidReason: true,
        voidedBy: { select: { id: true, name: true } },
      },
    });

    await tx.inventoryItem.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return result;
  });

  return json({
    ...updated,
    stockAdjustment: -logDelta(log.action, log.quantity),
  });
});
