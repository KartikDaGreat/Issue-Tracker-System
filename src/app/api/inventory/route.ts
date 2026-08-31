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
  conflict,
  json,
} from "@/lib/api";
import { getMovementByItem, EMPTY_MOVEMENT, stockStatus } from "@/lib/inventory";
import { LIMITS, parseSearch, trimmedString } from "@/lib/validation";
import type { Prisma } from "@prisma/client";

const createItemSchema = z.object({
  code: trimmedString(LIMITS.itemCode, "Item code"),
  name: trimmedString(LIMITS.itemName, "Item name"),
  categoryId: z.string().min(1, "Choose a category."),
  unit: trimmedString(LIMITS.unit, "Unit"),
});

export const GET = handler(async (req: NextRequest) => {
  const user = await requireSession();
  if (!canAccessInventory(user.role)) throw forbidden();

  const params = req.nextUrl.searchParams;
  const where: Prisma.InventoryItemWhereInput = {};

  // Deactivated items were previously unreachable through the API entirely,
  // so there was no way to review or reactivate one.
  const status = params.get("status") ?? "active";
  if (status === "active") where.isActive = true;
  else if (status === "inactive") where.isActive = false;
  else if (status !== "all") {
    throw badRequest(`"${status}" is not a valid status filter.`);
  }

  const categoryId = params.get("categoryId");
  if (categoryId && categoryId !== "all") where.categoryId = categoryId;

  const search = parseSearch(params.get("search"));
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }

  const items = await prisma.inventoryItem.findMany({
    where,
    select: {
      id: true,
      code: true,
      name: true,
      unit: true,
      isActive: true,
      updatedAt: true,
      category: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  // Stock comes from a single grouped aggregate rather than loading every log
  // row for every item into memory.
  const movement = await getMovementByItem(items.map((i) => i.id));

  const result = items.map((item) => {
    const m = movement.get(item.id) ?? EMPTY_MOVEMENT;
    return {
      ...item,
      quantityAvailable: m.stock,
      totalPurchased: m.purchased,
      totalUsed: m.used,
      totalBroken: m.broken,
      stockStatus: stockStatus(m.stock),
    };
  });

  return json(result);
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireSession();
  if (!canAccessInventory(user.role)) throw forbidden();

  const data = await parseBody(req, createItemSchema);

  const category = await prisma.inventoryCategory.findUnique({
    where: { id: data.categoryId },
    select: { id: true },
  });
  if (!category) throw badRequest("That category does not exist.");

  const existing = await prisma.inventoryItem.findUnique({
    where: { code: data.code },
    select: { id: true },
  });
  if (existing) throw conflict("That item code is already in use.");

  const item = await prisma.inventoryItem.create({
    data: {
      code: data.code,
      name: data.name,
      categoryId: data.categoryId,
      unit: data.unit,
      createdById: user.id,
    },
    include: { category: { select: { id: true, name: true } } },
  });

  return NextResponse.json(
    { ...item, quantityAvailable: 0, stockStatus: "OUT" },
    { status: 201 }
  );
});
