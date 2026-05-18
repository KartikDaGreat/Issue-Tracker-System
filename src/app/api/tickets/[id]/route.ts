import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewTicket } from "@/lib/permissions";
import { z } from "zod";

const updateTicketSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "PENDING", "CLOSED"]).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, email: true, role: true } },
      manager: { select: { id: true, name: true, email: true, role: true } },
      events: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      comments: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!canViewTicket(session.user.role, session.user.id, ticket)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(ticket);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!canViewTicket(session.user.role, session.user.id, ticket)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const events = [];

  if (parsed.data.status && parsed.data.status !== ticket.status) {
    events.push({
      type: "STATUS_CHANGE" as const,
      oldValue: ticket.status,
      newValue: parsed.data.status,
      ticketId: id,
      userId: session.user.id,
    });
  }

  if (parsed.data.severity && parsed.data.severity !== ticket.severity) {
    events.push({
      type: "STATUS_CHANGE" as const,
      oldValue: `Severity: ${ticket.severity}`,
      newValue: `Severity: ${parsed.data.severity}`,
      ticketId: id,
      userId: session.user.id,
    });
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: parsed.data,
    include: {
      creator: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
    },
  });

  if (events.length > 0) {
    await prisma.ticketEvent.createMany({ data: events });
  }

  // Notify relevant parties about status change
  if (parsed.data.status) {
    const notifyUserIds = [ticket.creatorId, ticket.managerId].filter(
      (uid): uid is string => !!uid && uid !== session.user.id
    );

    if (notifyUserIds.length > 0) {
      await prisma.notification.createMany({
        data: notifyUserIds.map((userId) => ({
          message: `Ticket #${ticket.ticketNumber} status changed to ${parsed.data.status}`,
          link: `/tickets/${ticket.id}`,
          userId,
        })),
      });
    }
  }

  return NextResponse.json(updated);
}
