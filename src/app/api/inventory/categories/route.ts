import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessInventory } from "@/lib/permissions";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessInventory(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const categories = await prisma.inventoryCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessInventory(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.inventoryCategory.findUnique({
    where: { name: parsed.data.name },
  });
  if (existing) {
    return NextResponse.json({ error: "Category already exists" }, { status: 409 });
  }

  const category = await prisma.inventoryCategory.create({
    data: { name: parsed.data.name },
  });

  return NextResponse.json(category, { status: 201 });
}
