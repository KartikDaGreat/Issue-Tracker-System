import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTicketWhereClause } from "@/lib/permissions";
import { buildTicketFilter, ticketListSelect } from "@/lib/ticket-query";
import { DEFAULT_PAGE_SIZE } from "@/lib/validation";
import DashboardClient from "./DashboardClient";
import type { Prisma, Role } from "@prisma/client";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Rebuilds a URLSearchParams from Next's resolved searchParams object. */
function toSearchParams(
  params: Record<string, string | string[] | undefined>
): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") out.set(key, value);
    else if (Array.isArray(value) && value[0]) out.set(key, value[0]);
  }
  return out;
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const raw = await searchParams;
  const params = toSearchParams(raw);

  // Default to the open queue rather than everything.
  if (!params.has("status")) params.set("status", "OPEN");

  const role = session.user.role as Role;
  const userId = session.user.id;

  // `page` is parsed defensively: `parseInt("abc")` produced NaN here, which
  // then reached Prisma as `skip: NaN`.
  const requestedPage = Number(params.get("page") ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = DEFAULT_PAGE_SIZE;

  let where: Prisma.TicketWhereInput;
  let filterError: string | null = null;
  try {
    where = buildTicketFilter(params, role, userId);
  } catch {
    // An unparseable filter in the URL should show an empty, recoverable page
    // rather than crashing the dashboard.
    filterError = "Some filters in this link were not valid, so they were ignored.";
    const fallback = new URLSearchParams({ status: params.get("status") ?? "OPEN" });
    where = buildTicketFilter(fallback, role, userId);
  }

  const baseWhere = getTicketWhereClause(role, userId) as Prisma.TicketWhereInput;
  const activeStatuses: Prisma.TicketWhereInput = {
    status: { notIn: ["CLOSED", "ACKNOWLEDGED"] },
  };

  // Tickets assigned to the viewer sort above everyone else's, which is what
  // gives the list its two banded sections.
  //
  // The split is done with two independently paginated queries rather than by
  // filtering the page in JavaScript. Filtering after `take` — as this page
  // previously did — meant the section counts only described the current page,
  // and your own tickets vanished from their section entirely on page 2.
  //
  // `managerId: { not: userId }` alone would drop unassigned rows, since SQL
  // comparisons against NULL are never true, so nulls are matched explicitly.
  const mineWhere: Prisma.TicketWhereInput = {
    AND: [where, { managerId: userId }],
  };
  const othersWhere: Prisma.TicketWhereInput = {
    AND: [
      where,
      { OR: [{ managerId: null }, { managerId: { not: userId } }] },
    ],
  };

  const [
    mineTotal,
    othersTotal,
    openCount,
    inProgressCount,
    criticalCount,
    overdueCount,
  ] = await Promise.all([
    prisma.ticket.count({ where: mineWhere }),
    prisma.ticket.count({ where: othersWhere }),
    prisma.ticket.count({ where: { AND: [baseWhere, { status: "OPEN" }] } }),
    prisma.ticket.count({
      where: { AND: [baseWhere, { status: "IN_PROGRESS" }] },
    }),
    prisma.ticket.count({
      where: { AND: [baseWhere, { severity: "CRITICAL" }, activeStatuses] },
    }),
    prisma.ticket.count({
      where: {
        AND: [baseWhere, { deadline: { lt: new Date() } }, activeStatuses],
      },
    }),
  ]);

  const total = mineTotal + othersTotal;
  const skip = (page - 1) * limit;

  // Treat the two groups as one continuous list: take what this page needs
  // from "mine" first, then fill the remainder from "others".
  const mineTake = Math.max(0, Math.min(limit, mineTotal - skip));
  const othersSkip = Math.max(0, skip - mineTotal);
  const othersTake = limit - mineTake;

  const [mine, others] = await Promise.all([
    mineTake > 0
      ? prisma.ticket.findMany({
          where: mineWhere,
          select: ticketListSelect,
          orderBy: { ticketNumber: "desc" },
          skip: Math.min(skip, mineTotal),
          take: mineTake,
        })
      : Promise.resolve([]),
    othersTake > 0
      ? prisma.ticket.findMany({
          where: othersWhere,
          select: ticketListSelect,
          orderBy: { ticketNumber: "desc" },
          skip: othersSkip,
          take: othersTake,
        })
      : Promise.resolve([]),
  ]);

  const serialize = (rows: typeof mine) =>
    rows.map((t) => ({
      ...t,
      deadline: t.deadline?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    }));

  return (
    <DashboardClient
      role={session.user.role}
      userId={userId}
      myTickets={serialize(mine)}
      otherTickets={serialize(others)}
      total={total}
      page={page}
      limit={limit}
      openCount={openCount}
      inProgressCount={inProgressCount}
      criticalCount={criticalCount}
      overdueCount={overdueCount}
      assignedToMeCount={mineTotal}
      filters={{
        status: params.get("status") ?? "OPEN",
        category: params.get("category") ?? "all",
        severity: params.get("severity") ?? "all",
        search: params.get("search") ?? "",
        assignedTo: params.get("assignedTo") ?? "",
        overdue: params.get("overdue") === "true",
      }}
      filterError={filterError}
    />
  );
}
