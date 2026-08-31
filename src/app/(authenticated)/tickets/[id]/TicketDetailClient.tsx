"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import CommentSection, {
  type CommentItem,
} from "@/components/tickets/CommentSection";
import InitialsAvatar from "@/components/common/Avatar";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { apiFetch, apiJson, errorMessage } from "@/lib/fetcher";
import {
  formatDate,
  humanizeEnum,
  isOverdue,
  toDateInputValue,
} from "@/lib/format";
import { CATEGORIES, LIMITS, SEVERITIES } from "@/lib/validation";

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
  comments: CommentItem[];
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

interface Props {
  ticket: TicketDetail;
  users: UserOption[];
  userRole: string;
  userId: string;
}

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "PENDING", "CLOSED"] as const;

export default function TicketDetailClient({
  ticket: initialTicket,
  users,
  userRole,
  userId,
}: Props) {
  const router = useRouter();
  const [ticket, setTicket] = useState(initialTicket);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [draft, setDraft] = useState({
    title: initialTicket.title,
    description: initialTicket.description,
    category: initialTicket.category,
    dateOfOccurrence: toDateInputValue(initialTicket.dateOfOccurrence),
  });

  const isAdmin = userRole === "ADMIN";
  const isAcknowledged = ticket.status === "ACKNOWLEDGED";

  // Mirrors the server: reaching this page means you have access to the
  // ticket, and access carries the right to act on it. Acknowledgement is the
  // only narrowing rule, and it locks the ticket for everyone.
  const canModify = !isAcknowledged;

  async function refreshTicket() {
    try {
      const fresh = await apiFetch<TicketDetail>(`/api/tickets/${ticket.id}`);
      setTicket(fresh);
      setDraft({
        title: fresh.title,
        description: fresh.description,
        category: fresh.category,
        dateOfOccurrence: toDateInputValue(fresh.dateOfOccurrence),
      });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function patch(body: Record<string, unknown>, successMessage: string) {
    if (saving) return;
    setSaving(true);
    try {
      await apiJson(`/api/tickets/${ticket.id}`, "PATCH", body);
      toast.success(successMessage);
      await refreshTicket();
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdits() {
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) {
      toast.error("Title cannot be empty.");
      return;
    }
    if (!draft.description.trim()) {
      toast.error("Description cannot be empty.");
      return;
    }

    await patch(
      {
        title: trimmedTitle,
        description: draft.description.trim(),
        category: draft.category,
        dateOfOccurrence: draft.dateOfOccurrence || null,
      },
      "Ticket updated"
    );
    setEditing(false);
  }

  async function reassign(managerId: string) {
    if (saving) return;
    setSaving(true);
    try {
      await apiJson(`/api/tickets/${ticket.id}/reassign`, "PATCH", {
        managerId,
      });
      toast.success("Ticket reassigned");
      await refreshTicket();
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTicket() {
    try {
      await apiJson(`/api/tickets/${ticket.id}`, "DELETE");
      toast.success(`Ticket #${ticket.ticketNumber} deleted`);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const overdue =
    isOverdue(ticket.deadline) &&
    ticket.status !== "CLOSED" &&
    !isAcknowledged;

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard")}
          className="mb-3 gap-1 text-muted-foreground"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          Dashboard
        </Button>

        {editing ? (
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            maxLength={LIMITS.title}
            className="h-11 text-xl font-bold"
            aria-label="Ticket title"
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">
              <span className="text-primary">#{ticket.ticketNumber}</span>{" "}
              {ticket.title}
            </h1>
            <TicketStatusBadge status={ticket.status} />
            <SeverityBadge severity={ticket.severity} />
          </div>
        )}

        <p className="mt-1 text-sm text-muted-foreground">
          Created by {ticket.creator.name} on {formatDate(ticket.createdAt)}
        </p>
      </div>

      {isAcknowledged && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          This ticket has been acknowledged and is locked from further changes.
        </div>
      )}

      {overdue && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          This ticket passed its deadline of {formatDate(ticket.deadline)}.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="label-caps text-[13px]">
                Description
              </CardTitle>
              {canModify && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Edit details
                </button>
              )}
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <Textarea
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                    rows={6}
                    maxLength={LIMITS.description}
                    aria-label="Ticket description"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Category
                      </label>
                      <Select
                        value={draft.category}
                        onValueChange={(v) =>
                          v && setDraft({ ...draft, category: v })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {humanizeEnum(c)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="occurred"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Date of occurrence
                      </label>
                      <Input
                        id="occurred"
                        type="date"
                        max={new Date().toISOString().split("T")[0]}
                        value={draft.dateOfOccurrence}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            dateOfOccurrence: e.target.value,
                          })
                        }
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 border-t pt-3">
                    <Button size="sm" onClick={saveEdits} disabled={saving}>
                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => {
                        setEditing(false);
                        setDraft({
                          title: ticket.title,
                          description: ticket.description,
                          category: ticket.category,
                          dateOfOccurrence: toDateInputValue(
                            ticket.dateOfOccurrence
                          ),
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                  {ticket.description}
                </p>
              )}
            </CardContent>
          </Card>

          <CommentSection
            ticketId={ticket.id}
            comments={ticket.comments}
            currentUserId={userId}
            isAdmin={isAdmin}
            onChanged={refreshTicket}
            readonly={isAcknowledged && !isAdmin}
          />

          <TicketTimeline events={ticket.events} />
        </div>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="label-caps text-[13px]">
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Category</span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                  {humanizeEnum(ticket.category)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created by</span>
                <div className="flex items-center gap-2">
                  <InitialsAvatar name={ticket.creator.name} className="h-5 w-5 text-[10px]" />
                  <span className="font-medium">{ticket.creator.name}</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Assigned to</span>
                {ticket.manager ? (
                  <div className="flex items-center gap-2">
                    <InitialsAvatar
                      name={ticket.manager.name}
                      tone="success"
                      className="h-5 w-5 text-[10px]"
                    />
                    <span className="font-medium">{ticket.manager.name}</span>
                  </div>
                ) : (
                  <span className="italic text-muted-foreground">Unassigned</span>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(ticket.createdAt)}</span>
              </div>
              {ticket.dateOfOccurrence && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Occurred</span>
                    <span>{formatDate(ticket.dateOfOccurrence)}</span>
                  </div>
                </>
              )}
              {ticket.deadline && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Deadline</span>
                    <span
                      className={
                        overdue ? "font-medium text-red-600 dark:text-red-400" : ""
                      }
                    >
                      {formatDate(ticket.deadline)}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {canModify && (
            <Card className="relative border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              {saving && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[1px]">
                  <svg className="h-5 w-5 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                </div>
              )}
              <CardHeader className="pb-3">
                <CardTitle className="label-caps text-[13px]">
                  Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Status
                  </label>
                  <Select
                    value={ticket.status}
                    onValueChange={(v) =>
                      v && v !== ticket.status && patch({ status: v }, "Status updated")
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {humanizeEnum(s)}
                        </SelectItem>
                      ))}
                      {isAdmin && ticket.status === "CLOSED" && (
                        <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {isAdmin && ticket.status !== "CLOSED" && (
                    <p className="text-xs text-muted-foreground">
                      Close the ticket first to acknowledge it.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Severity
                  </label>
                  <Select
                    value={ticket.severity}
                    onValueChange={(v) =>
                      v &&
                      v !== ticket.severity &&
                      patch({ severity: v }, "Severity updated")
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITIES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {humanizeEnum(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="deadline"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Deadline
                  </label>
                  <Input
                    id="deadline"
                    type="date"
                    className="h-9"
                    value={toDateInputValue(ticket.deadline)}
                    onChange={(e) =>
                      patch(
                        { deadline: e.target.value || null },
                        "Deadline updated"
                      )
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Assigned to
                  </label>
                  <Select
                    value={ticket.manager?.id ?? ""}
                    onValueChange={(v) =>
                      v && v !== ticket.manager?.id && reassign(v)
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} · {humanizeEnum(u.role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {isAdmin && (
            // A quiet footer action rather than a third card: deletion is rare,
            // and a red-ringed panel on every ticket drew the eye away from the
            // controls people actually use.
            <div className="px-1 pt-1">
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-red-600 hover:underline dark:hover:text-red-400"
              >
                Delete this ticket
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ticket #${ticket.ticketNumber}?`}
        description="This cannot be undone. All comments and activity history for this ticket will be removed."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={deleteTicket}
      />
    </div>
  );
}
