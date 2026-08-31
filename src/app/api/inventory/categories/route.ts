import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessInventory } from "@/lib/permissions";
import {
  handler,
  requireSession,
  parseBody,
  forbidden,
  conflict,
  json,
} from "@/lib/api";
import { LIMITS, trimmedString } from "@/lib/validation";
import { z } from "zod";

const createCategorySchema = z.object({
  name: trimmedString(LIMITS.categoryName, "Category name"),
});

export const GET = handler(async () => {
  const user = await requireSession();
  if (!canAccessInventory(user.role)) throw forbidden();

  const categories = await prisma.inventoryCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return json(categories);
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireSession();
  if (!canAccessInventory(user.role)) throw forbidden();

  const data = await parseBody(req, createCategorySchema);

  const existing = await prisma.inventoryCategory.findUnique({
    where: { name: data.name },
    select: { id: true },
  });
  if (existing) throw conflict("A category with that name already exists.");

  const category = await prisma.inventoryCategory.create({
    data: { name: data.name },
  });

  return NextResponse.json({ ...category, _count: { items: 0 } }, { status: 201 });
});
