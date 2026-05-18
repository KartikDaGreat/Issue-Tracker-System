import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTicketWhereClause } from "@/lib/permissions";
import { z } from "zod";

const createTicketSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum([
    "ACADEMICS",
    "PARENT_ISSUES",
    "STUDENT_ISSUES",
    "FACILITIES_ISSUES",
    "STAFF_ISSUES",
    "SECURITY",
    "TRANSPORT",
    "MISCELLANEOUS",
  ]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  managerId: z.string().optional(),
  dateOfOccurrence: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const severity = searchParams.get("severity");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const sort = searchParams.get("sort") || "createdAt";
  const order = searchParams.get("order") || "desc";

  const where: Record<string, unknown> = getTicketWhereClause(
    session.user.role,
    session.user.id
  );

  if (status) where.status = status;
  if (category) where.category = category;
  if (severity) where.severity = severity;

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
      },
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  return NextResponse.json({ tickets, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const ticket = await prisma.ticket.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      severity: parsed.data.severity || "MEDIUM",
      creatorId: session.user.id,
      managerId: parsed.data.managerId || null,
      dateOfOccurrence: parsed.data.dateOfOccurrence
        ? new Date(parsed.data.dateOfOccurrence)
        : null,
    },
    include: {
      creator: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
    },
  });

  // Create CREATED event
  await prisma.ticketEvent.create({
    data: {
      type: "CREATED",
      newValue: `Ticket #${ticket.ticketNumber} created`,
      ticketId: ticket.id,
      userId: session.user.id,
    },
  });

  // Notify manager if assigned
  if (ticket.managerId && ticket.managerId !== session.user.id) {
    await prisma.notification.create({
      data: {
        message: `You have been assigned ticket #${ticket.ticketNumber}: ${ticket.title}`,
        link: `/tickets/${ticket.id}`,
        userId: ticket.managerId,
      },
    });
  }

  return NextResponse.json(ticket, { status: 201 });
}
