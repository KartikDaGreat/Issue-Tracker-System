import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
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
import { LIMITS, trimmedString } from "@/lib/validation";

const renameSchema = z.object({
  name: trimmedString(LIMITS.categoryName, "Category name"),
});

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSession();
  if (user.role !== "ADMIN") {
    throw forbidden("Only admins can rename categories.");
  }

  const { id } = await ctx.params;
  const { name } = await parseBody(req, renameSchema);

  const category = await prisma.inventoryCategory.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!category) throw notFound("That category does not exist.");

  if (name !== category.name) {
    const clash = await prisma.inventoryCategory.findUnique({
      where: { name },
      select: { id: true },
    });
    if (clash) throw conflict("A category with that name already exists.");
  }

  const updated = await prisma.inventoryCategory.update({
    where: { id },
    data: { name },
    include: { _count: { select: { items: true } } },
  });

  return json(updated);
});

export const DELETE = handler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSession();
  if (user.role !== "ADMIN") {
    throw forbidden("Only admins can delete categories.");
  }

  const { id } = await ctx.params;

  const category = await prisma.inventoryCategory.findUnique({
    where: { id },
    select: { id: true, _count: { select: { items: true } } },
  });
  if (!category) throw notFound("That category does not exist.");

  if (category._count.items > 0) {
    throw badRequest(
      `This category still holds ${category._count.items} item(s). Move or deactivate them first.`
    );
  }

  await prisma.inventoryCategory.delete({ where: { id } });
  return json({ success: true });
});
