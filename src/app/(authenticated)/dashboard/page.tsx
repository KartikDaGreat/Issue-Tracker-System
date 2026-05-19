"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TicketTable from "@/components/tickets/TicketTable";

interface Ticket {
  id: string;
  ticketNumber: number;
  title: string;
  category: string;
  severity: string;
  status: string;
  createdAt: string;
  creator: { id: string; name: string };
  manager: { id: string; name: string } | null;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const status = searchParams.get("status") ?? "OPEN";
  const category = searchParams.get("category") || "";
  const severity = searchParams.get("severity") || "";
  const page = parseInt(searchParams.get("page") || "1");

  useEffect(() => {
    async function fetchTickets() {
      setLoading(true);
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      if (category) params.set("category", category);
      if (severity) params.set("severity", severity);
      params.set("page", String(page));
      params.set("sort", "severity");
      params.set("order", "desc");

      const res = await fetch(`/api/tickets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets);
        setTotal(data.total);
      }
      setLoading(false);
    }
    fetchTickets();
  }, [status, category, severity, page]);

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== "page") params.set("page", "1");
    router.push(`/dashboard?${params}`);
  }

  const totalPages = Math.ceil(total / 20);

  const openCount = tickets.filter((t) => t.status === "OPEN").length;
  const inProgressCount = tickets.filter((t) => t.status === "IN_PROGRESS").length;
  const criticalCount = tickets.filter((t) => t.severity === "CRITICAL").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {session?.user.role === "ADMIN" || session?.user.role === "PRINCIPAL"
              ? "Overview of all tickets"
              : "Your assigned and created tickets"}
          </p>
        </div>
        <Link href="/tickets/new">
          <Button className="gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            New Ticket
          </Button>
        </Link>
      </div>

      {!loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card className="border-0 shadow-sm ring-1 ring-black/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</p>
                  <p className="mt-1 text-2xl font-bold">{total}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm ring-1 ring-black/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Open</p>
                  <p className="mt-1 text-2xl font-bold text-blue-600">{openCount}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm ring-1 ring-black/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">In Progress</p>
                  <p className="mt-1 text-2xl font-bold text-amber-600">{inProgressCount}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm ring-1 ring-black/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Critical</p>
                  <p className="mt-1 text-2xl font-bold text-red-600">{criticalCount}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-0 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <span className="text-sm font-medium text-gray-700">Filters:</span>
          <Select
            value={status}
            onValueChange={(v) => v && setFilter("status", v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={category || "all"}
            onValueChange={(v) => v && setFilter("category", v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="ACADEMICS">Academics</SelectItem>
              <SelectItem value="PARENT_ISSUES">Parent Issues</SelectItem>
              <SelectItem value="STUDENT_ISSUES">Student Issues</SelectItem>
              <SelectItem value="FACILITIES_ISSUES">Facilities</SelectItem>
              <SelectItem value="STAFF_ISSUES">Staff Issues</SelectItem>
              <SelectItem value="SECURITY">Security</SelectItem>
              <SelectItem value="TRANSPORT">Transport</SelectItem>
              <SelectItem value="MISCELLANEOUS">Miscellaneous</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={severity || "all"}
            onValueChange={(v) => v && setFilter("severity", v)}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <svg className="h-6 w-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                <span className="text-sm text-muted-foreground">Loading tickets...</span>
              </div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
              </div>
              <p className="mt-4 text-sm font-medium text-gray-900">No tickets found</p>
              <p className="mt-1 text-sm text-muted-foreground">Get started by creating your first ticket.</p>
              <Link href="/tickets/new">
                <Button variant="outline" className="mt-4 gap-2" size="sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                  Create Ticket
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <TicketTable tickets={tickets} />
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setFilter("page", String(page - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setFilter("page", String(page + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
