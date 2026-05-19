"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import TicketStatusBadge from "@/components/tickets/TicketStatusBadge";
import SeverityBadge from "@/components/tickets/SeverityBadge";
import TicketTimeline from "@/components/tickets/TicketTimeline";
import CommentSection from "@/components/tickets/CommentSection";

interface TicketDetail {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  dateOfOccurrence: string | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  creator: { id: string; name: string; email: string; role: string };
  manager: { id: string; name: string; email: string; role: string } | null;
  events: {
    id: string;
    type: string;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string;
    user: { id: string; name: string };
  }[];
  comments: {
    id: string;
    body: string;
    createdAt: string;
    author: { id: string; name: string };
  }[];
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);

  async function fetchTicket() {
    const res = await fetch(`/api/tickets/${id}`);
    if (res.ok) {
      setTicket(await res.json());
    } else if (res.status === 403) {
      setError("You don't have permission to view this ticket.");
    } else {
      setError("Ticket not found.");
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchTicket();
    fetch("/api/users?minimal=true")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [id]);

  async function updateStatus(status: string) {
    if (saving) return;
    setSaving(true);
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success("Status updated");
      await fetchTicket();
    } else {
      toast.error("Failed to update status");
    }
    setSaving(false);
  }

  async function updateSeverity(severity: string) {
    if (saving) return;
    setSaving(true);
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ severity }),
    });
    if (res.ok) {
      toast.success("Severity updated");
      await fetchTicket();
    } else {
      toast.error("Failed to update severity");
    }
    setSaving(false);
  }

  async function reassign(managerId: string) {
    if (saving) return;
    setSaving(true);
    const res = await fetch(`/api/tickets/${id}/reassign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId }),
    });
    if (res.ok) {
      toast.success("Ticket reassigned");
      await fetchTicket();
    } else {
      toast.error("Failed to reassign ticket");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-6 w-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <span className="text-sm text-muted-foreground">Loading ticket...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>
        </div>
        <p className="mt-4 font-medium text-gray-900">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!ticket) return null;

  const isAdmin = session?.user.role === "ADMIN";
  const isAcknowledged = ticket.status === "ACKNOWLEDGED";

  const canReassign =
    !isAcknowledged && (
    session?.user.role === "ADMIN" ||
    session?.user.role === "PRINCIPAL" ||
    session?.user.id === ticket.manager?.id);

  const selectedReassignUser = users.find((u) => u.id === ticket.manager?.id);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="mb-3 gap-1 text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          Dashboard
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-primary">#{ticket.ticketNumber}</span> {ticket.title}
          </h1>
          <TicketStatusBadge status={ticket.status} />
          <SeverityBadge severity={ticket.severity} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Created by {ticket.creator.name} on {new Date(ticket.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {isAcknowledged && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          This ticket has been acknowledged and is locked from further changes.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-sm ring-1 ring-black/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {ticket.description}
              </p>
            </CardContent>
          </Card>

          <CommentSection
            ticketId={ticket.id}
            comments={ticket.comments}
            onCommentAdded={fetchTicket}
            readonly={isAcknowledged && !isAdmin}
          />

          <TicketTimeline events={ticket.events} />
        </div>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm ring-1 ring-black/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Category</span>
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {ticket.category.replace(/_/g, " ")}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created by</span>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    {ticket.creator.name.split(" ").map((n) => n[0]).join("")}
                  </span>
                  <span className="font-medium">{ticket.creator.name}</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Assigned to</span>
                {ticket.manager ? (
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-[10px] font-semibold text-green-700">
                      {ticket.manager.name.split(" ").map((n) => n[0]).join("")}
                    </span>
                    <span className="font-medium">{ticket.manager.name}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">Unassigned</span>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
              </div>
              {ticket.dateOfOccurrence && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Occurred</span>
                    <span>{new Date(ticket.dateOfOccurrence).toLocaleDateString()}</span>
                  </div>
                </>
              )}
              {ticket.deadline && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Deadline</span>
                    <span className={new Date(ticket.deadline) < new Date() ? "text-red-600 font-medium" : ""}>
                      {new Date(ticket.deadline).toLocaleDateString()}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {!(isAcknowledged && !isAdmin) && (
          <Card className="relative border-0 shadow-sm ring-1 ring-black/5">
            {saving && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/60 backdrop-blur-[1px]">
                <svg className="h-5 w-5 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              </div>
            )}
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Status</label>
                <Select value={ticket.status} onValueChange={(v) => v && updateStatus(v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                    {isAdmin && <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Severity</label>
                <Select value={ticket.severity} onValueChange={(v) => v && updateSeverity(v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isAdmin && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500">Deadline</label>
                  <input
                    type="date"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    value={ticket.deadline ? new Date(ticket.deadline).toISOString().split("T")[0] : ""}
                    onChange={async (e) => {
                      if (saving) return;
                      setSaving(true);
                      const res = await fetch(`/api/tickets/${id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ deadline: e.target.value || null }),
                      });
                      if (res.ok) {
                        toast.success("Deadline updated");
                        await fetchTicket();
                      } else {
                        toast.error("Failed to update deadline");
                      }
                      setSaving(false);
                    }}
                  />
                </div>
              )}

              {canReassign && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500">Reassign</label>
                  <Select
                    value={ticket.manager?.id || ""}
                    onValueChange={(v) => v && reassign(v)}
                  >
                    <SelectTrigger className="h-9">
                      {selectedReassignUser ? (
                        <span className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                            {selectedReassignUser.name.split(" ").map((n) => n[0]).join("")}
                          </span>
                          {selectedReassignUser.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Select user</span>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </div>
      </div>
    </div>
  );
}
