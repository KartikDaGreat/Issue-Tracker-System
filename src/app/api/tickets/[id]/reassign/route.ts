import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReassignTicket } from "@/lib/permissions";
import { z } from "zod";

const reassignSchema = z.object({
  managerId: z.string().min(1),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { manager: { select: { name: true } } },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!canReassignTicket(session.user.role, session.user.id, ticket)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = reassignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const newManager = await prisma.user.findUnique({
    where: { id: parsed.data.managerId },
    select: { id: true, name: true },
  });

  if (!newManager) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.ticket.update({
      where: { id },
      data: { managerId: parsed.data.managerId },
      include: {
        creator: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
      },
    });

    await tx.ticketEvent.create({
      data: {
        type: "REASSIGNED",
        oldValue: ticket.manager?.name || "Unassigned",
        newValue: newManager.name,
        ticketId: id,
        userId: session.user.id,
      },
    });

    if (newManager.id !== session.user.id) {
      await tx.notification.create({
        data: {
          message: `You have been assigned ticket #${ticket.ticketNumber}: ${ticket.title}`,
          link: `/tickets/${ticket.id}`,
          userId: newManager.id,
        },
      });
    }

    return result;
  });

  return NextResponse.json(updated);
}
