import { getTicketWhereClause } from "./permissions";
import { badRequest } from "./api";
import {
  CATEGORIES,
  SEVERITIES,
  STATUSES,
  TICKET_SORT_FIELDS,
  parseEnumParam,
  parseSearch,
  parseSortOrder,
  type TicketSortField,
} from "./validation";
import type { Prisma, Role } from "@prisma/client";

/**
 * Query construction shared by the ticket list endpoint, the CSV export and the
 * dashboard page, so all three always agree on what a filter means.
 *
 * Lives in `lib` rather than beside the route because Next.js only permits
 * route handlers and a fixed set of config values to be exported from a
 * `route.ts` file.
 */

export const ticketListSelect = {
  id: true,
  ticketNumber: true,
  title: true,
  category: true,
  severity: true,
  status: true,
  deadline: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: { id: true, name: true } },
  manager: { select: { id: true, name: true } },
} satisfies Prisma.TicketSelect;

export const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  editedAt: true,
  authorId: true,
  author: { select: { id: true, name: true } },
} satisfies Prisma.CommentSelect;

export function buildTicketFilter(
  params: URLSearchParams,
  userRole: Role,
  userId: string
): Prisma.TicketWhereInput {
  // Role scoping and free-text search both want to express an OR. Collecting
  // every clause into a single AND keeps one from silently overwriting the
  // other, which would have widened a staff member's visible set.
  const clauses: Prisma.TicketWhereInput[] = [
    getTicketWhereClause(userRole, userId),
  ];

  const status = parseEnumParam(params.get("status"), STATUSES, "status");
  const category = parseEnumParam(params.get("category"), CATEGORIES, "category");
  const severity = parseEnumParam(params.get("severity"), SEVERITIES, "severity");

  if (status) clauses.push({ status });
  if (category) clauses.push({ category });
  if (severity) clauses.push({ severity });

  if (params.get("assignedTo") === "me") clauses.push({ managerId: userId });
  if (params.get("unassigned") === "true") clauses.push({ managerId: null });

  if (params.get("overdue") === "true") {
    clauses.push({
      deadline: { lt: new Date() },
      ...(status ? {} : { status: { notIn: ["CLOSED", "ACKNOWLEDGED"] } }),
    });
  }

  const search = parseSearch(params.get("search"));
  if (search) {
    const asNumber = Number(search.replace(/^#/, ""));
    clauses.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        ...(Number.isInteger(asNumber) && asNumber > 0
          ? [{ ticketNumber: asNumber }]
          : []),
      ],
    });
  }

  return { AND: clauses };
}

export function buildTicketOrderBy(
  params: URLSearchParams
):
  | Prisma.TicketOrderByWithRelationInput
  | Prisma.TicketOrderByWithRelationInput[] {
  const sort = params.get("sort") ?? "ticketNumber";
  const order = parseSortOrder(params.get("order"));

  // Composite triage ordering: worst severity first, then soonest deadline.
  if (sort === "severity_deadline") {
    return [
      { severity: "desc" },
      { deadline: { sort: "asc", nulls: "last" } },
      { ticketNumber: "desc" },
    ];
  }

  if (!(TICKET_SORT_FIELDS as readonly string[]).includes(sort)) {
    throw badRequest(
      `"${sort}" is not a sortable field. Allowed: ${TICKET_SORT_FIELDS.join(", ")}.`
    );
  }

  return { [sort as TicketSortField]: order };
}

/** Shape returned by `GET /api/tickets/stats`. */
export interface TicketStats {
  totals: {
    all: number;
    open: number;
    inProgress: number;
    pending: number;
    closed: number;
    acknowledged: number;
    overdue: number;
    unassigned: number;
  };
  byCategory: { category: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  byManager: { managerId: string; name: string; open: number; total: number }[];
  createdPerMonth: { month: string; created: number; closed: number }[];
  resolution: {
    medianHours: number | null;
    averageHours: number | null;
    sampleSize: number;
  };
}
