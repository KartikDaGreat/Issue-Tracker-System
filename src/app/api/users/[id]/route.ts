import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z
    .enum([
      "ADMIN",
      "PRINCIPAL",
      "ACADEMIC_HEAD",
      "FACILITIES_MANAGER",
      "OFFICE_MANAGER",
      "STAFF",
    ])
    .optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageUsers(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageUsers(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.password) {
    updateData.hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    delete updateData.password;
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageUsers(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Cannot delete yourself" },
      { status: 400 }
    );
  }

  const ticketCount = await prisma.ticket.count({
    where: { OR: [{ creatorId: id }, { managerId: id }] },
  });

  if (ticketCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete user with ${ticketCount} associated ticket(s). Reassign or close their tickets first.` },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { userId: id } });
    await tx.comment.deleteMany({ where: { authorId: id } });
    await tx.ticketEvent.deleteMany({ where: { userId: id } });
    await tx.user.delete({ where: { id } });
  });

  return NextResponse.json({ success: true });
}
