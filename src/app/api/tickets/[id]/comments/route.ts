import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewTicket } from "@/lib/permissions";
import { z } from "zod";

const commentSchema = z.object({
  body: z.string().min(1),
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
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!canViewTicket(session.user.role, session.user.id, ticket)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comments = await prisma.comment.findMany({
    where: { ticketId: id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}

export async function POST(
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
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const comment = await prisma.comment.create({
    data: {
      body: parsed.data.body,
      ticketId: id,
      authorId: session.user.id,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  // Create COMMENT event
  await prisma.ticketEvent.create({
    data: {
      type: "COMMENT",
      newValue: parsed.data.body.slice(0, 100),
      ticketId: id,
      userId: session.user.id,
    },
  });

  // Notify ticket creator and manager
  const notifyUserIds = [ticket.creatorId, ticket.managerId].filter(
    (uid): uid is string => !!uid && uid !== session.user.id
  );

  if (notifyUserIds.length > 0) {
    await prisma.notification.createMany({
      data: notifyUserIds.map((userId) => ({
        message: `New comment on ticket #${ticket.ticketNumber} by ${session.user.name}`,
        link: `/tickets/${ticket.id}`,
        userId,
      })),
    });
  }

  return NextResponse.json(comment, { status: 201 });
}
