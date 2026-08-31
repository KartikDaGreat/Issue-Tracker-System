import { NextRequest } from "next/server";
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
  conflict,
  json,
} from "@/lib/api";
import { getMovementByItem, EMPTY_MOVEMENT, stockStatus } from "@/lib/inventory";
import { LIMITS, trimmedString } from "@/lib/validation";
import type { Prisma } from "@prisma/client";

/**
 * PATCH previously accepted only `isActive`, so a mistyped item name, unit or
 * category was permanent. It also passed an unchecked id straight to
 * `update()`, turning a stale id into an unhandled 500.
 */
const updateItemSchema = z
  .object({
    name: trimmedString(LIMITS.itemName, "Item name").optional(),
    code: trimmedString(LIMITS.itemCode, "Item code").optional(),
    unit: trimmedString(LIMITS.unit, "Unit").optional(),
    categoryId: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No changes were supplied.",
  });

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSession();
  if (!canAccessInventory(user.role)) throw forbidden();

  const { id } = await ctx.params;
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      unit: true,
      isActive: true,
      updatedAt: true,
      category: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!item) throw notFound("That item does not exist.");

  const movement = (await getMovementByItem([id])).get(id) ?? EMPTY_MOVEMENT;

  return json({
    ...item,
    quantityAvailable: movement.stock,
    totalPurchased: movement.purchased,
    totalUsed: movement.used,
    totalBroken: movement.broken,
    stockStatus: stockStatus(movement.stock),
  });
});

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSession();
  if (!canAccessInventory(user.role)) throw forbidden();

  const { id } = await ctx.params;
  const data = await parseBody(req, updateItemSchema);

  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    select: { id: true, code: true },
  });
  if (!item) throw notFound("That item does not exist.");

  // Retiring an item hides it from every stock view, so it stays admin-only.
  if (data.isActive !== undefined && user.role !== "ADMIN") {
    throw forbidden("Only admins can activate or deactivate items.");
  }

  if (data.categoryId) {
    const category = await prisma.inventoryCategory.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });
    if (!category) throw badRequest("That category does not exist.");
  }

  if (data.code && data.code !== item.code) {
    const clash = await prisma.inventoryItem.findUnique({
      where: { code: data.code },
      select: { id: true },
    });
    if (clash) throw conflict("That item code is already in use.");
  }

  const updateData: Prisma.InventoryItemUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.code !== undefined) updateData.code = data.code;
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.categoryId !== undefined) {
    updateData.category = { connect: { id: data.categoryId } };
  }

  const updated = await prisma.inventoryItem.update({
    where: { id },
    data: updateData,
    include: { category: { select: { id: true, name: true } } },
  });

  return json(updated);
});
