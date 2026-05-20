import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessInventory } from "@/lib/permissions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessInventory(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  // Only admin can deactivate
  if ("isActive" in body && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admin can deactivate items" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if ("isActive" in body) data.isActive = body.isActive;

  const item = await prisma.inventoryItem.update({
    where: { id },
    data,
  });

  return NextResponse.json(item);
}
