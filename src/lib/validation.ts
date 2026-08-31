import { z } from "zod";
import { badRequest } from "./api";

export const CATEGORIES = [
  "ACADEMICS",
  "PARENT_ISSUES",
  "STUDENT_ISSUES",
  "FACILITIES_ISSUES",
  "STAFF_ISSUES",
  "SECURITY",
  "TRANSPORT",
  "MISCELLANEOUS",
] as const;

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "CLOSED",
  "ACKNOWLEDGED",
] as const;

export const ROLES = [
  "ADMIN",
  "PRINCIPAL",
  "ACADEMIC_HEAD",
  "FACILITIES_MANAGER",
  "OFFICE_MANAGER",
  "STAFF",
] as const;

export const INVENTORY_ACTIONS = ["PURCHASED", "USED", "BROKEN"] as const;

/** Field length caps. Previously every text field was `min(1)` with no ceiling. */
export const LIMITS = {
  title: 200,
  description: 5000,
  comment: 5000,
  name: 120,
  email: 254,
  password: 200,
  itemCode: 50,
  itemName: 200,
  unit: 50,
  categoryName: 100,
  logDetails: 1000,
  search: 100,
} as const;

/**
 * bcrypt work factor. Raised from the previous 10: 12 is the current sensible
 * default and still well under 300ms on the deployment target.
 */
export const BCRYPT_ROUNDS = 12;

export const trimmedString = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

/** Accepts a bare YYYY-MM-DD (what `<input type="date">` submits). */
export const dateOnlyString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Use a valid date.");

export const emailString = z
  .string()
  .trim()
  .toLowerCase()
  .max(LIMITS.email)
  .pipe(z.email("Enter a valid email address."));

export const passwordString = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(LIMITS.password);

/**
 * Whitelist of columns a client may sort tickets by. Previously `sort` went
 * straight into `orderBy: { [sort]: order }`, so `?sort=creator` threw an
 * unhandled Prisma error.
 */
export const TICKET_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "ticketNumber",
  "deadline",
  "severity",
  "status",
  "title",
] as const;

export type TicketSortField = (typeof TICKET_SORT_FIELDS)[number];

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

/** Parses and clamps `?page` / `?limit`, rejecting NaN instead of passing it to Prisma. */
export function parsePagination(
  params: URLSearchParams,
  defaultLimit = DEFAULT_PAGE_SIZE
): Pagination {
  const page = parsePositiveInt(params.get("page"), 1, "page");
  const limit = Math.min(
    parsePositiveInt(params.get("limit"), defaultLimit, "limit"),
    MAX_PAGE_SIZE
  );
  return { page, limit, skip: (page - 1) * limit };
}

export function parsePositiveInt(
  raw: string | null,
  fallback: number,
  label: string
): number {
  if (raw === null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw badRequest(`"${label}" must be a positive whole number.`);
  }
  return value;
}

/** Validates a query param against a fixed set of allowed values. */
export function parseEnumParam<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  label: string
): T | undefined {
  if (!raw || raw === "all") return undefined;
  if (!(allowed as readonly string[]).includes(raw)) {
    throw badRequest(`"${raw}" is not a valid ${label}.`);
  }
  return raw as T;
}

export function parseSortOrder(raw: string | null): "asc" | "desc" {
  if (!raw) return "desc";
  if (raw !== "asc" && raw !== "desc") {
    throw badRequest(`"order" must be "asc" or "desc".`);
  }
  return raw;
}

export function parseSearch(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().slice(0, LIMITS.search);
  return trimmed.length > 0 ? trimmed : undefined;
}
