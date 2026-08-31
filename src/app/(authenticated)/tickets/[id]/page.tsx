import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewTicket } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import TicketDetailClient from "./TicketDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
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
        where: { deletedAt: null },
        select: {
          id: true,
          body: true,
          createdAt: true,
          editedAt: true,
          authorId: true,
          author: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) notFound();

  if (!canViewTicket(session.user.role, session.user.id, ticket)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="font-medium text-foreground">
          You do not have access to this ticket.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask an admin if you believe this is a mistake.
        </p>
      </div>
    );
  }

  // Anyone who can see the ticket can reassign it, so everyone reaching this
  // point needs the assignee list.
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

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
      editedAt: c.editedAt?.toISOString() ?? null,
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
