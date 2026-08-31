import type { ReactNode } from "react";

/**
 * Single source of truth for navigation, shared by the desktop sidebar and the
 * mobile bar. Both previously carried their own copy of the item list *and* an
 * identical inline "which item is active" expression.
 */

export interface NavItem {
  href: string;
  label: string;
  shortLabel?: string;
  roles: string[] | null;
  icon: ReactNode;
  /** Hidden from the compact mobile bar when false. */
  mobile?: boolean;
}

const icon = (path: ReactNode, size = 18) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {path}
  </svg>
);

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    roles: null,
    mobile: true,
    icon: icon(
      <>
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
      </>
    ),
  },
  {
    href: "/tickets/new",
    label: "New Ticket",
    shortLabel: "New",
    roles: null,
    mobile: true,
    icon: icon(
      <>
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </>
    ),
  },
  {
    href: "/reports",
    label: "Reports",
    roles: ["ADMIN", "PRINCIPAL"],
    mobile: true,
    icon: icon(
      <>
        <path d="M3 3v18h18" />
        <path d="M7 16v-5" />
        <path d="M12 16V8" />
        <path d="M17 16v-3" />
      </>
    ),
  },
  {
    href: "/inventory",
    label: "Inventory",
    roles: ["ADMIN", "OFFICE_MANAGER", "FACILITIES_MANAGER"],
    icon: icon(
      <>
        <path d="m7.5 4.27 9 5.15" />
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </>
    ),
  },
  {
    href: "/admin",
    label: "User Management",
    shortLabel: "Admin",
    roles: ["ADMIN"],
    mobile: true,
    icon: icon(
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    href: "/admin/performance",
    label: "Performance",
    shortLabel: "Analysis",
    roles: ["ADMIN"],
    icon: icon(
      <>
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </>
    ),
  },
];

export function visibleNavItems(role: string, mobileOnly = false): NavItem[] {
  return NAV_ITEMS.filter(
    (item) =>
      (!item.roles || item.roles.includes(role)) &&
      (!mobileOnly || item.mobile)
  );
}

/**
 * Highlights only the most specific matching item, so `/admin/performance`
 * does not also light up `/admin`.
 */
export function activeHref(pathname: string, items: NavItem[]): string | null {
  const matches = items.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, item) =>
    item.href.length > best.href.length ? item : best
  ).href;
}
