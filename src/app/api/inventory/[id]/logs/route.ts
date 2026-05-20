import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessInventory } from "@/lib/permissions";
import { z } from "zod";

const createLogSchema = z.object({
  action: z.enum(["PURCHASED", "USED", "BROKEN"]),
  quantity: z.number().int().positive(),
  details: z.string().min(1),
  date: z.string().min(1),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessInventory(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const logs = await prisma.inventoryLog.findMany({
    where: { itemId: id },
    select: {
      id: true,
      action: true,
      quantity: true,
      details: true,
      date: true,
      createdAt: true,
      loggedBy: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(logs);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessInventory(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = createLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const log = await prisma.inventoryLog.create({
    data: {
      action: parsed.data.action,
      quantity: parsed.data.quantity,
      details: parsed.data.details,
      date: new Date(parsed.data.date),
      itemId: id,
      loggedById: session.user.id,
    },
    include: { loggedBy: { select: { id: true, name: true } } },
  });

  // Touch the item's updatedAt
  await prisma.inventoryItem.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json(log, { status: 201 });
}
