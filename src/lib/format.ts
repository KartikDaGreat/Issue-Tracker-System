/**
 * Shared display/formatting helpers.
 *
 * `getInitials` in particular used to be inlined in six places as
 * `name.split(" ").map((n) => n[0]).join("")`, which produced "AundefinedB"
 * for any name containing a double space.
 */

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase();
  return initials.slice(0, 2) || "?";
}

/** Human label for an enum-ish constant: STAFF_ISSUES -> "STAFF ISSUES". */
export function humanizeEnum(value: string): string {
  return value.replace(/_/g, " ");
}

/**
 * Deadlines are date-only values. Storing them at UTC midnight made a deadline
 * of "today" compare as already overdue for the whole day, so they are stored
 * at the end of the day instead.
 */
export function endOfDayUTC(dateInput: string | Date): Date {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${String(dateInput)}`);
  }
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

export function startOfDayUTC(dateInput: string | Date): Date {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${String(dateInput)}`);
  }
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/** True when a deadline has genuinely passed (not merely "is today"). */
export function isOverdue(deadline: string | Date | null | undefined): boolean {
  if (!deadline) return false;
  const value = new Date(deadline);
  if (Number.isNaN(value.getTime())) return false;
  return value.getTime() < Date.now();
}

/** `<input type="date">` wants a bare YYYY-MM-DD in UTC terms. */
export function toDateInputValue(
  value: string | Date | null | undefined
): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
