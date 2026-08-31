import { prisma } from "@/lib/prisma";
import { getTicketWhereClause } from "@/lib/permissions";
import { handler, requireSession, json } from "@/lib/api";
import type { TicketStats } from "@/lib/ticket-query";
import type { Prisma } from "@prisma/client";

/**
 * Aggregate ticket metrics for the analytics screen.
 *
 * Everything is scoped by the caller's role, so a staff member sees statistics
 * for their own queue rather than the whole school. All counts are computed by
 * the database.
 */

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "PENDING"] as const;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export const GET = handler(async () => {
  const user = await requireSession();
  const scope = getTicketWhereClause(user.role, user.id) as Prisma.TicketWhereInput;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [
    statusGroups,
    categoryGroups,
    severityGroups,
    overdue,
    unassigned,
    managerGroups,
    recent,
    resolved,
  ] = await Promise.all([
    prisma.ticket.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ["category"],
      where: scope,
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ["severity"],
      where: scope,
      _count: { _all: true },
    }),
    prisma.ticket.count({
      where: {
        AND: [
          scope,
          { deadline: { lt: new Date() } },
          { status: { notIn: ["CLOSED", "ACKNOWLEDGED"] } },
        ],
      },
    }),
    prisma.ticket.count({
      where: {
        AND: [
          scope,
          { managerId: null },
          { status: { notIn: ["CLOSED", "ACKNOWLEDGED"] } },
        ],
      },
    }),
    prisma.ticket.groupBy({
      by: ["managerId", "status"],
      where: { AND: [scope, { managerId: { not: null } }] },
      _count: { _all: true },
    }),
    prisma.ticket.findMany({
      where: { AND: [scope, { createdAt: { gte: sixMonthsAgo } }] },
      select: { createdAt: true, status: true, updatedAt: true },
    }),
    // Resolution time uses the CLOSED/ACKNOWLEDGED event rather than
    // updatedAt, so a later edit cannot distort the measurement.
    prisma.ticketEvent.findMany({
      where: {
        type: { in: ["STATUS_CHANGE", "ACKNOWLEDGED"] },
        newValue: "CLOSED",
        ticket: scope,
      },
      select: { createdAt: true, ticket: { select: { createdAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  const statusCount = (status: string) =>
    statusGroups.find((g) => g.status === status)?._count._all ?? 0;

  const managerIds = Array.from(
    new Set(managerGroups.map((g) => g.managerId).filter((id): id is string => !!id))
  );
  const managers = managerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: managerIds } },
        select: { id: true, name: true },
      })
    : [];
  const managerNames = new Map(managers.map((m) => [m.id, m.name]));

  const byManagerMap = new Map<string, { open: number; total: number }>();
  for (const group of managerGroups) {
    if (!group.managerId) continue;
    const entry = byManagerMap.get(group.managerId) ?? { open: 0, total: 0 };
    entry.total += group._count._all;
    if ((OPEN_STATUSES as readonly string[]).includes(group.status)) {
      entry.open += group._count._all;
    }
    byManagerMap.set(group.managerId, entry);
  }

  const monthly = new Map<string, { created: number; closed: number }>();
  for (const ticket of recent) {
    const key = monthKey(ticket.createdAt);
    const entry = monthly.get(key) ?? { created: 0, closed: 0 };
    entry.created += 1;
    if (ticket.status === "CLOSED" || ticket.status === "ACKNOWLEDGED") {
      entry.closed += 1;
    }
    monthly.set(key, entry);
  }

  const durationsHours = resolved
    .map(
      (event) =>
        (event.createdAt.getTime() - event.ticket.createdAt.getTime()) / 3_600_000
    )
    .filter((hours) => hours >= 0)
    .sort((a, b) => a - b);

  const median =
    durationsHours.length === 0
      ? null
      : durationsHours.length % 2 === 1
        ? durationsHours[(durationsHours.length - 1) / 2]
        : (durationsHours[durationsHours.length / 2 - 1] +
            durationsHours[durationsHours.length / 2]) /
          2;

  const average =
    durationsHours.length === 0
      ? null
      : durationsHours.reduce((sum, h) => sum + h, 0) / durationsHours.length;

  const stats: TicketStats = {
    totals: {
      all: statusGroups.reduce((sum, g) => sum + g._count._all, 0),
      open: statusCount("OPEN"),
      inProgress: statusCount("IN_PROGRESS"),
      pending: statusCount("PENDING"),
      closed: statusCount("CLOSED"),
      acknowledged: statusCount("ACKNOWLEDGED"),
      overdue,
      unassigned,
    },
    byCategory: categoryGroups
      .map((g) => ({ category: g.category, count: g._count._all }))
      .sort((a, b) => b.count - a.count),
    bySeverity: severityGroups
      .map((g) => ({ severity: g.severity, count: g._count._all }))
      .sort((a, b) => b.count - a.count),
    byManager: Array.from(byManagerMap.entries())
      .map(([managerId, counts]) => ({
        managerId,
        name: managerNames.get(managerId) ?? "Unknown",
        ...counts,
      }))
      .sort((a, b) => b.open - a.open),
    createdPerMonth: Array.from(monthly.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, counts]) => ({ month, ...counts })),
    resolution: {
      medianHours: median === null ? null : Math.round(median * 10) / 10,
      averageHours: average === null ? null : Math.round(average * 10) / 10,
      sampleSize: durationsHours.length,
    },
  };

  return json(stats, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
});
