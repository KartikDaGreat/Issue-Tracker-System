"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InitialsAvatar from "@/components/common/Avatar";
import { apiFetch, errorMessage } from "@/lib/fetcher";
import { humanizeEnum } from "@/lib/format";

interface TicketStats {
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

/** Renders a duration in the largest sensible unit. */
function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} hrs`;
  return `${(hours / 24).toFixed(1)} days`;
}

function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  return new Date(Number(year), Number(m) - 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
  });
}

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "bg-green-500",
  MEDIUM: "bg-blue-500",
  HIGH: "bg-orange-500",
  CRITICAL: "bg-red-500",
};

/** Horizontal proportion bar — avoids pulling in a charting dependency. */
function BarRow({
  label,
  value,
  max,
  color = "bg-primary",
  href,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  href?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const content = (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate">{label}</span>
        <span className="ml-3 shrink-0 font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block transition-opacity hover:opacity-80">
      {content}
    </Link>
  ) : (
    content
  );
}

export default function ReportsClient() {
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<TicketStats>("/api/tickets/stats")
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="font-medium">Could not load reports</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const maxCategory = Math.max(1, ...stats.byCategory.map((c) => c.count));
  const maxSeverity = Math.max(1, ...stats.bySeverity.map((s) => s.count));
  const maxManager = Math.max(1, ...stats.byManager.map((m) => m.total));
  const maxMonth = Math.max(
    1,
    ...stats.createdPerMonth.map((m) => Math.max(m.created, m.closed))
  );

  const headline = [
    { label: "Total tickets", value: stats.totals.all, href: "/dashboard?status=all" },
    { label: "Currently open", value: stats.totals.open, href: "/dashboard?status=OPEN" },
    {
      label: "Overdue",
      value: stats.totals.overdue,
      tone: "text-red-600 dark:text-red-400",
      href: "/dashboard?overdue=true&status=all",
    },
    {
      label: "Unassigned",
      value: stats.totals.unassigned,
      tone: "text-amber-600 dark:text-amber-400",
      href: "/dashboard?unassigned=true&status=all",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ticket volume, workload and resolution performance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {headline.map((card) => (
          <Link key={card.label} href={card.href}>
            <Card className="border-0 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md dark:ring-white/10">
              <CardContent className="p-4">
                <p className="label-caps">
                  {card.label}
                </p>
                <p className={`mt-1 text-2xl font-bold tabular ${card.tone ?? ""}`}>
                  {card.value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="label-caps text-[13px]">
            Resolution time
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.resolution.sampleSize === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tickets have been closed yet, so there is nothing to measure.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Median</p>
                <p className="mt-1 text-xl font-bold tabular">
                  {formatHours(stats.resolution.medianHours)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Average</p>
                <p className="mt-1 text-xl font-bold tabular">
                  {formatHours(stats.resolution.averageHours)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Based on</p>
                <p className="mt-1 text-xl font-bold tabular">
                  {stats.resolution.sampleSize}
                </p>
                <p className="text-xs text-muted-foreground">closed tickets</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="label-caps text-[13px]">
              By category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tickets yet.</p>
            ) : (
              stats.byCategory.map((row) => (
                <BarRow
                  key={row.category}
                  label={humanizeEnum(row.category)}
                  value={row.count}
                  max={maxCategory}
                  href={`/dashboard?category=${row.category}&status=all`}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="label-caps text-[13px]">
              By severity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.bySeverity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tickets yet.</p>
            ) : (
              stats.bySeverity.map((row) => (
                <BarRow
                  key={row.severity}
                  label={humanizeEnum(row.severity)}
                  value={row.count}
                  max={maxSeverity}
                  color={SEVERITY_COLORS[row.severity] ?? "bg-primary"}
                  href={`/dashboard?severity=${row.severity}&status=all`}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="label-caps text-[13px]">
            Workload by assignee
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.byManager.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tickets are currently assigned.
            </p>
          ) : (
            <div className="space-y-4">
              {stats.byManager.map((manager) => (
                <div key={manager.managerId} className="flex items-center gap-3">
                  <InitialsAvatar name={manager.name} className="h-8 w-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <BarRow
                      label={manager.name}
                      value={manager.total}
                      max={maxManager}
                    />
                  </div>
                  <div className="w-20 shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {manager.open}
                    </p>
                    <p className="text-xs text-muted-foreground">open</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="label-caps text-[13px]">
            Volume over the last 6 months
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.createdPerMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tickets were created in this period.
            </p>
          ) : (
            <>
              <div className="flex items-end justify-between gap-3 overflow-x-auto pb-2">
                {stats.createdPerMonth.map((row) => (
                  <div
                    key={row.month}
                    className="flex min-w-14 flex-1 flex-col items-center gap-2"
                  >
                    <div className="flex h-40 w-full items-end justify-center gap-1">
                      <div
                        className="w-1/3 rounded-t bg-blue-500"
                        style={{
                          height: `${Math.max(2, (row.created / maxMonth) * 100)}%`,
                        }}
                        title={`${row.created} created`}
                      />
                      <div
                        className="w-1/3 rounded-t bg-emerald-500"
                        style={{
                          height: `${Math.max(2, (row.closed / maxMonth) * 100)}%`,
                        }}
                        title={`${row.closed} closed`}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {monthLabel(row.month)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-4 border-t pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Created
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Resolved
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
