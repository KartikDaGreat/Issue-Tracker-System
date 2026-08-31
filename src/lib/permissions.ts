import { Role } from "@prisma/client";

type TicketRef = {
  creatorId: string;
  managerId: string | null;
  status?: string;
};

const OVERSIGHT_ROLES: Role[] = [Role.ADMIN, Role.PRINCIPAL];

function hasOversight(userRole: Role): boolean {
  return OVERSIGHT_ROLES.includes(userRole);
}

export function canViewTicket(
  userRole: Role,
  userId: string,
  ticket: TicketRef
): boolean {
  if (hasOversight(userRole)) return true;
  return ticket.creatorId === userId || ticket.managerId === userId;
}

/**
 * Who may change a ticket: its status, severity, deadline, descriptive fields,
 * and who it is assigned to.
 *
 * Access to a ticket carries the right to act on it. Anyone involved — the
 * reporter, the current assignee, or an oversight role — can triage it and
 * hand it to whoever should actually deal with it. Only two rules narrow this:
 * acknowledgement is admin-only, and an acknowledged ticket is locked
 * outright.
 */
export function canModifyTicket(
  userRole: Role,
  userId: string,
  ticket: TicketRef
): boolean {
  return canViewTicket(userRole, userId, ticket);
}

/** Reassignment follows the same rule as any other change to a ticket. */
export function canReassignTicket(
  userRole: Role,
  userId: string,
  ticket: TicketRef
): boolean {
  return canModifyTicket(userRole, userId, ticket);
}

export function canAcknowledgeTicket(userRole: Role): boolean {
  return userRole === Role.ADMIN;
}

/** Comments belong to their author; admins can moderate. */
export function canModifyComment(
  userRole: Role,
  userId: string,
  comment: { authorId: string }
): boolean {
  return comment.authorId === userId || userRole === Role.ADMIN;
}

export function canManageUsers(userRole: Role): boolean {
  return userRole === Role.ADMIN;
}

export function canAccessInventory(userRole: Role | string): boolean {
  return (
    userRole === Role.ADMIN ||
    userRole === Role.OFFICE_MANAGER ||
    userRole === Role.FACILITIES_MANAGER
  );
}

/** Voiding an inventory log rewrites stock history, so it is admin-only. */
export function canVoidInventoryLog(userRole: Role): boolean {
  return userRole === Role.ADMIN;
}

export function canViewReports(userRole: Role): boolean {
  return (
    userRole === Role.ADMIN ||
    userRole === Role.PRINCIPAL ||
    userRole === Role.OFFICE_MANAGER ||
    userRole === Role.FACILITIES_MANAGER
  );
}

export function getTicketWhereClause(userRole: Role, userId: string) {
  if (hasOversight(userRole)) return {};
  return {
    OR: [{ creatorId: userId }, { managerId: userId }],
  };
}
