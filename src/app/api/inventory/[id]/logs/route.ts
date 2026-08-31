import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAccessInventory } from "@/lib/permissions";
import {
  handler,
  requireSession,
  parseBody,
  badRequest,
  forbidden,
  notFound,
  json,
} from "@/lib/api";
import { getStockForItem, NOT_VOIDED } from "@/lib/inventory";
import { startOfDayUTC } from "@/lib/format";
import {
  INVENTORY_ACTIONS,
  LIMITS,
  dateOnlyString,
  parsePagination,
  trimmedString,
} from "@/lib/validation";

const createLogSchema = z.object({
  action: z.enum(INVENTORY_ACTIONS),
  quantity: z
    .number()
    .int("Quantity must be a whole number.")
    .positive("Quantity must be greater than zero.")
    .max(1_000_000, "That quantity looks too large."),
  details: trimmedString(LIMITS.logDetails, "Details"),
  date: dateOnlyString,
});

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSession();
  if (!canAccessInventory(user.role)) throw forbidden();

  const { id } = await ctx.params;
  const params = req.nextUrl.searchParams;
  const { page, limit, skip } = parsePagination(params, 50);

  const includeVoided = params.get("includeVoided") === "true";
  const where = { itemId: id, ...(includeVoided ? {} : NOT_VOIDED) };

  const [logs, total] = await Promise.all([
    prisma.inventoryLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        quantity: true,
        details: true,
        date: true,
        createdAt: true,
        voidedAt: true,
        voidReason: true,
        loggedBy: { select: { id: true, name: true } },
        voidedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    prisma.inventoryLog.count({ where }),
  ]);

  return json({
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

export const POST = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSession();
  if (!canAccessInventory(user.role)) throw forbidden();

  const { id } = await ctx.params;
  const data = await parseBody(req, createLogSchema);

  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    select: { id: true, name: true, unit: true, isActive: true },
  });
  if (!item) throw notFound("That item does not exist.");
  if (!item.isActive) {
    throw badRequest("That item is deactivated, so stock cannot be logged against it.");
  }

  const date = startOfDayUTC(data.date);
  if (date.getTime() > Date.now()) {
    throw badRequest("The date cannot be in the future.");
  }

  const log = await prisma.$transaction(async (tx) => {
    // Read the current stock inside the transaction so the check and the
    // insert cannot interleave with a concurrent write. Nothing previously
    // stopped stock from going negative.
    if (data.action !== "PURCHASED") {
      const stock = await getStockForItem(tx, id);
      if (data.quantity > stock) {
        throw badRequest(
          `Only ${stock} ${item.unit} of ${item.name} ${
            stock === 1 ? "is" : "are"
          } in stock, so ${data.quantity} cannot be recorded as ${data.action.toLowerCase()}.`
        );
      }
    }

    const created = await tx.inventoryLog.create({
      data: {
        action: data.action,
        quantity: data.quantity,
        details: data.details,
        date,
        itemId: id,
        loggedById: user.id,
      },
      include: { loggedBy: { select: { id: true, name: true } } },
    });

    // Same transaction as the log, so the item's timestamp can never drift
    // from its stock history.
    await tx.inventoryItem.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return created;
  });

  return NextResponse.json(log, { status: 201 });
});
