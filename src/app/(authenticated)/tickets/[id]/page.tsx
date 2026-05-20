import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewTicket } from "@/lib/permissions";
import { redirect } from "next/navigation";
import TicketDetailClient from "./TicketDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;

  const [ticket, users] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true, role: true } },
        manager: { select: { id: true, name: true, email: true, role: true } },
        events: {
          select: {
            id: true,
            type: true,
            oldValue: true,
            newValue: true,
            createdAt: true,
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        comments: {
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="font-medium text-gray-900">Ticket not found.</p>
      </div>
    );
  }

  if (!canViewTicket(session.user.role, session.user.id, ticket)) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="font-medium text-gray-900">You don&apos;t have permission to view this ticket.</p>
      </div>
    );
  }

  const serialized = {
    ...ticket,
    dateOfOccurrence: ticket.dateOfOccurrence?.toISOString() ?? null,
    deadline: ticket.deadline?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    events: ticket.events.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
    comments: ticket.comments.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  };

  return (
    <TicketDetailClient
      ticket={serialized}
      users={users}
      userRole={session.user.role}
      userId={session.user.id}
    />
  );
}
