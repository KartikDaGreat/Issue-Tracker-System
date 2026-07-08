import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTicketWhereClause } from "@/lib/permissions";
import DashboardClient from "./DashboardClient";

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const params = await searchParams;
  const status = params.status ?? "OPEN";
  const category = params.category || "";
  const severity = params.severity || "";
  const page = parseInt(params.page || "1");
  const limit = 20;

  const baseWhere: Record<string, unknown> = getTicketWhereClause(
    session.user.role,
    session.user.id
  );

  const where: Record<string, unknown> = { ...baseWhere };
  if (status && status !== "all") where.status = status;
  if (category && category !== "all") where.category = category;
  if (severity && severity !== "all") where.severity = severity;

  const ticketSelect = {
    id: true,
    ticketNumber: true,
    title: true,
    category: true,
    severity: true,
    status: true,
    deadline: true,
    createdAt: true,
    creator: { select: { id: true, name: true } },
    manager: { select: { id: true, name: true } },
  } as const;

  const [tickets, total, openCount, inProgressCount, criticalCount] =
    await Promise.all([
      prisma.ticket.findMany({
        where,
        select: ticketSelect,
        orderBy: { ticketNumber: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ticket.count({ where }),
      prisma.ticket.count({ where: { ...baseWhere, status: "OPEN" } }),
      prisma.ticket.count({ where: { ...baseWhere, status: "IN_PROGRESS" } }),
      prisma.ticket.count({ where: { ...baseWhere, severity: "CRITICAL" } }),
    ]);

  const serialized = tickets.map((t) => ({
    ...t,
    deadline: t.deadline?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));

  const userId = session.user.id;
  const myTickets = serialized.filter((t) => t.manager?.id === userId);
  const otherTickets = serialized.filter((t) => t.manager?.id !== userId);

  return (
    <DashboardClient
      role={session.user.role}
      myTickets={myTickets}
      otherTickets={otherTickets}
      total={total}
      openCount={openCount}
      inProgressCount={inProgressCount}
      criticalCount={criticalCount}
      status={status}
      category={category}
      severity={severity}
      page={page}
    />
  );
}
