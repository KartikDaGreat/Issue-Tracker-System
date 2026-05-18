import { Role } from "@prisma/client";

export function canViewTicket(
  userRole: Role,
  userId: string,
  ticket: { creatorId: string; managerId: string | null }
): boolean {
  if (userRole === Role.ADMIN || userRole === Role.PRINCIPAL) return true;
  return ticket.creatorId === userId || ticket.managerId === userId;
}

export function canReassignTicket(
  userRole: Role,
  userId: string,
  ticket: { managerId: string | null }
): boolean {
  if (userRole === Role.ADMIN || userRole === Role.PRINCIPAL) return true;
  return ticket.managerId === userId;
}

export function canManageUsers(userRole: Role): boolean {
  return userRole === Role.ADMIN;
}

export function getTicketWhereClause(userRole: Role, userId: string) {
  if (userRole === Role.ADMIN || userRole === Role.PRINCIPAL) return {};
  return {
    OR: [{ creatorId: userId }, { managerId: userId }],
  };
}
