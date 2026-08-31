"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/fetcher";
import { visibleNavItems, activeHref } from "./nav-items";

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [closedCount, setClosedCount] = useState(0);

  const role = session?.user.role;

  useEffect(() => {
    if (role !== "ADMIN") return;

    let cancelled = false;

    // Only the count is needed, so ask for a single row.
    apiFetch<{ total: number }>("/api/tickets?status=CLOSED&limit=1")
      .then((data) => {
        if (!cancelled) setClosedCount(data.total);
      })
      .catch(() => {
        /* a missing badge is not worth surfacing */
      });

    return () => {
      cancelled = true;
    };
    // Deliberately not keyed on `pathname`: this used to refetch on every
    // single navigation.
  }, [role]);

  if (!session) return null;

  const items = visibleNavItems(session.user.role);
  const active = activeHref(pathname, items);
  // Derived rather than cleared in an effect, so a role change cannot leave a
  // stale badge behind.
  const badgeCount = role === "ADMIN" ? closedCount : 0;

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-background md:block">
      <nav className="flex flex-col gap-1 p-3 pt-4">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Navigation
        </p>
        {items.map((item) => {
          const isActive = active === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <span className={isActive ? "text-primary" : "text-muted-foreground/70"}>
                {item.icon}
              </span>
              {item.label}
              {item.href === "/admin" && badgeCount > 0 && (
                <span
                  title={`${badgeCount} closed ticket(s) awaiting acknowledgement`}
                  className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white"
                >
                  {badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
