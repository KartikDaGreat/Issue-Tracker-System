"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TicketTable, { type TicketRow } from "@/components/tickets/TicketTable";
import { apiJson, errorMessage } from "@/lib/fetcher";
import { CATEGORIES, SEVERITIES, STATUSES } from "@/lib/validation";
import { humanizeEnum } from "@/lib/format";

interface Filters {
  status: string;
  category: string;
  severity: string;
  search: string;
  assignedTo: string;
  overdue: boolean;
}

interface Props {
  role: string;
  userId: string;
  tickets: TicketRow[];
  total: number;
  page: number;
  limit: number;
  openCount: number;
  inProgressCount: number;
  criticalCount: number;
  overdueCount: number;
  assignedToMeCount: number;
  filters: Filters;
  filterError: string | null;
}

/** Every filter a stat card resets before applying its own. */
const CLEARED_FILTERS: Record<string, string | null> = {
  status: "all",
  category: null,
  severity: null,
  search: null,
  assignedTo: null,
  overdue: null,
};

const icon = (path: React.ReactNode) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
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

/**
 * Four headline counts, each a shortcut to the matching filter. "Overdue" and
 * "Assigned to me" are deliberately not cards: they already carry their counts
 * on the filter chips below, and a fifth card left an orphan on every
 * breakpoint.
 */
const statCards = [
  {
    key: "total",
    label: "Total",
    filter: null,
    tone: "text-foreground",
    badge: "bg-muted text-muted-foreground",
    icon: icon(
      <>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      </>
    ),
  },
  {
    key: "open",
    label: "Open",
    filter: { status: "OPEN" },
    tone: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    icon: icon(
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    ),
  },
  {
    key: "inProgress",
    label: "In Progress",
    filter: { status: "IN_PROGRESS" },
    tone: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    icon: icon(
      <>
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  {
    key: "critical",
    label: "Critical",
    filter: { severity: "CRITICAL" },
    tone: "text-red-600 dark:text-red-400",
    badge: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
    icon: icon(
      <>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
  },
] as const;

export default function DashboardClient({
  role,
  tickets,
  total,
  page,
  limit,
  openCount,
  inProgressCount,
  criticalCount,
  overdueCount,
  assignedToMeCount,
  filters,
  filterError,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [rawSelectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  function updateParams(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "" || value === "all") params.delete(key);
      else params.set(key, value);
    }
    if (!("page" in changes)) params.delete("page");
    startTransition(() => router.push(`/dashboard?${params}`));
  }

  // Debounced in the change handler rather than an effect, so the input stays
  // uncontrolled and resets naturally when the URL changes (via its `key`).
  function onSearchChange(value: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => updateParams({ search: value }),
      400
    );
  }

  const hasActiveFilters =
    filters.status !== "OPEN" ||
    filters.category !== "all" ||
    filters.severity !== "all" ||
    Boolean(filters.search) ||
    Boolean(filters.assignedTo) ||
    filters.overdue;

  const stats: Record<string, number> = {
    total,
    open: openCount,
    inProgress: inProgressCount,
    critical: criticalCount,
    overdue: overdueCount,
  };

  // Narrowing the selection to what is actually on screen means paging or
  // filtering can never leave a bulk action pointed at invisible tickets, with
  // no need to clear state from an effect.
  const visibleIds = useMemo(
    () => new Set(tickets.map((t) => t.id)),
    [tickets]
  );
  const selectedIds = useMemo(
    () => new Set(Array.from(rawSelectedIds).filter((id) => visibleIds.has(id))),
    [rawSelectedIds, visibleIds]
  );
  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  function toggleOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(ids: string[], selectAll: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (selectAll) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function runBulk(type: "status" | "severity", value: string) {
    if (selectedArray.length === 0 || bulkWorking) return;
    setBulkWorking(true);
    try {
      const result = await apiJson<{
        updated: number;
        unchanged: number;
        skipped: { ticketNumber: number; reason: string }[];
      }>("/api/tickets/bulk", "POST", {
        ticketIds: selectedArray,
        action: { type, value },
      });

      const parts = [`${result.updated} ticket(s) updated`];
      if (result.unchanged > 0) parts.push(`${result.unchanged} already set`);
      if (result.skipped.length > 0) {
        parts.push(`${result.skipped.length} skipped`);
      }
      toast.success(parts.join(", "));

      setSelectedIds(new Set());
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBulkWorking(false);
    }
  }

  function exportCsv() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    window.location.href = `/api/tickets/export?${params}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {role === "ADMIN" || role === "PRINCIPAL"
              ? "Overview of all tickets"
              : "Your assigned and created tickets"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} className="gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            Export CSV
          </Button>
          <Link href="/tickets/new">
            <Button className="gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              New Ticket
            </Button>
          </Link>
        </div>
      </div>

      {filterError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          {filterError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card
            key={card.key}
            onClick={() =>
              // Each card clears the other filters, then applies its own, so
              // clicking one always lands on exactly what its number counted.
              updateParams({ ...CLEARED_FILTERS, ...(card.filter ?? {}) })
            }
            className="cursor-pointer border-0 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md dark:ring-white/10"
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <p className="truncate label-caps">
                  {card.label}
                </p>
                <p className={`mt-1 text-2xl font-bold tabular ${card.tone}`}>
                  {stats[card.key]}
                </p>
              </div>
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.badge}`}
              >
                {card.icon}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <div className="space-y-3 border-b px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <Input
                key={filters.search}
                defaultValue={filters.search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search by title, description or #number"
                className="h-9 pl-9"
                aria-label="Search tickets"
              />
            </div>

            <Select
              value={filters.status}
              onValueChange={(v) => v && updateParams({ status: v })}
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {humanizeEnum(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.category}
              onValueChange={(v) => v && updateParams({ category: v })}
            >
              <SelectTrigger className="h-9 w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {humanizeEnum(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.severity}
              onValueChange={(v) => v && updateParams({ severity: v })}
            >
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {humanizeEnum(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={filters.assignedTo === "me" ? "default" : "outline"}
              onClick={() =>
                updateParams({
                  assignedTo: filters.assignedTo === "me" ? null : "me",
                })
              }
            >
              Assigned to me ({assignedToMeCount})
            </Button>
            <Button
              size="sm"
              variant={filters.overdue ? "default" : "outline"}
              onClick={() =>
                updateParams({ overdue: filters.overdue ? null : "true" })
              }
            >
              Overdue ({overdueCount})
            </Button>
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  startTransition(() => router.push("/dashboard?status=OPEN"))
                }
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {selectedArray.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b bg-primary/5 px-4 py-2.5">
            <span className="text-sm font-medium">
              {selectedArray.length} selected
            </span>
            <Select
              value=""
              onValueChange={(v) => v && runBulk("status", v)}
              disabled={bulkWorking}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue placeholder="Set status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.filter((s) => s !== "ACKNOWLEDGED").map((s) => (
                  <SelectItem key={s} value={s}>
                    {humanizeEnum(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value=""
              onValueChange={(v) => v && runBulk("severity", v)}
              disabled={bulkWorking}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue placeholder="Set severity" />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {humanizeEnum(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </Button>
          </div>
        )}

        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
            </div>
            {hasActiveFilters ? (
              <>
                <p className="mt-4 text-sm font-medium">
                  No tickets match these filters
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try widening your search or clearing the filters.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() =>
                    startTransition(() => router.push("/dashboard?status=OPEN"))
                  }
                >
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm font-medium">No tickets yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Get started by creating your first ticket.
                </p>
                <Link href="/tickets/new">
                  <Button variant="outline" className="mt-4 gap-2" size="sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    Create Ticket
                  </Button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <div className={isPending ? "opacity-60 transition-opacity" : ""}>
              <TicketTable
                tickets={tickets}
                selection={{
                  selectedIds,
                  onToggle: toggleOne,
                  onToggleAll: toggleAll,
                }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1}–
                {Math.min(page * limit, total)} of {total}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isPending}
                    onClick={() => updateParams({ page: String(page - 1) })}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || isPending}
                    onClick={() => updateParams({ page: String(page + 1) })}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
