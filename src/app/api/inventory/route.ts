import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessInventory } from "@/lib/permissions";
import { z } from "zod";

const createItemSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  categoryId: z.string().min(1),
  unit: z.string().min(1).max(50),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessInventory(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");

  const where: Record<string, unknown> = { isActive: true };
  if (categoryId) where.categoryId = categoryId;

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
      logs: {
        select: { action: true, quantity: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = items.map((item) => {
    let stock = 0;
    for (const log of item.logs) {
      if (log.action === "PURCHASED") stock += log.quantity;
      else stock -= log.quantity;
    }
    const { logs: _, ...rest } = item;
    return { ...rest, quantityAvailable: stock };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessInventory(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.inventoryItem.findUnique({
    where: { code: parsed.data.code },
  });
  if (existing) {
    return NextResponse.json({ error: "Item code already exists" }, { status: 409 });
  }

  const item = await prisma.inventoryItem.create({
    data: {
      code: parsed.data.code,
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      unit: parsed.data.unit,
      createdById: session.user.id,
    },
    include: { category: { select: { id: true, name: true } } },
  });

  return NextResponse.json(item, { status: 201 });
}
