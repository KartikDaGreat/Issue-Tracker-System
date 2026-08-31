"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SeverityBadge from "@/components/tickets/SeverityBadge";
import InitialsAvatar from "@/components/common/Avatar";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { apiFetch, apiJson, errorMessage } from "@/lib/fetcher";
import { formatDate, humanizeEnum } from "@/lib/format";
import { ROLES } from "@/lib/validation";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count?: { createdTickets: number; managedTickets: number };
}

interface ClosedTicket {
  id: string;
  ticketNumber: number;
  title: string;
  severity: string;
  status: string;
  updatedAt: string;
  creator: { id: string; name: string };
}

const MIN_PASSWORD_LENGTH = 8;

const roleColors: Record<string, string> = {
  ADMIN: "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-950 dark:text-purple-300",
  PRINCIPAL: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950 dark:text-blue-300",
  ACADEMIC_HEAD: "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-950 dark:text-indigo-300",
  FACILITIES_MANAGER: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300",
  OFFICE_MANAGER: "bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-950 dark:text-teal-300",
  STAFF: "bg-gray-50 text-gray-600 ring-gray-500/20 dark:bg-gray-900 dark:text-gray-300",
};

export default function AdminPage() {
  const { data: session } = useSession();

  const [activeTab, setActiveTab] = useState<"users" | "completed">("users");

  const [users, setUsers] = useState<User[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userPages, setUserPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editName, setEditName] = useState("");

  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const [closedTickets, setClosedTickets] = useState<ClosedTicket[]>([]);
  const [closedCount, setClosedCount] = useState(0);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // Debounce so typing in the search box is not one request per keystroke.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onSearchChange(value: string) {
    setSearch(value);
    setLoading(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setUserPage(1);
    }, 350);
  }

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(userPage),
        limit: "25",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const data = await apiFetch<{
        users: User[];
        total: number;
        totalPages: number;
      }>(`/api/users?${params}`);

      setUsers(data.users);
      setUserTotal(data.total);
      setUserPages(data.totalPages);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [userPage, debouncedSearch, statusFilter]);

  const fetchClosedTickets = useCallback(async () => {
    try {
      const data = await apiFetch<{ tickets: ClosedTicket[]; total: number }>(
        "/api/tickets?status=CLOSED&limit=100&sort=ticketNumber&order=desc"
      );
      setClosedTickets(data.tickets);
      setClosedCount(data.total);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  // These effects declare their own async work inline rather than calling the
  // shared callbacks: the lint rule treats an effect that invokes any
  // setState-containing function as a synchronous state update. The callbacks
  // above remain for imperative refetches after a mutation.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          page: String(userPage),
          limit: "25",
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (statusFilter !== "all") params.set("status", statusFilter);

        const data = await apiFetch<{
          users: User[];
          total: number;
          totalPages: number;
        }>(`/api/users?${params}`);

        if (cancelled) return;
        setUsers(data.users);
        setUserTotal(data.total);
        setUserPages(data.totalPages);
      } catch (err) {
        if (!cancelled) toast.error(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userPage, debouncedSearch, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ total: number }>(
          "/api/tickets?status=CLOSED&limit=1"
        );
        if (!cancelled) setClosedCount(data.total);
      } catch {
        /* the badge is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "completed") return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ tickets: ClosedTicket[]; total: number }>(
          "/api/tickets?status=CLOSED&limit=100&sort=ticketNumber&order=desc"
        );
        if (cancelled) return;
        setClosedTickets(data.tickets);
        setClosedCount(data.total);
      } catch (err) {
        if (!cancelled) toast.error(errorMessage(err));
      } finally {
        if (!cancelled) setLoadingTickets(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  async function patchUser(
    id: string,
    body: Record<string, unknown>,
    successMessage: string
  ) {
    if (saving) return false;
    setSaving(true);
    try {
      await apiJson(`/api/users/${id}`, "PATCH", body);
      toast.success(successMessage);
      await fetchUsers();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveUser() {
    if (!editingUser) return;
    const body: Record<string, unknown> = {};
    if (editName.trim() && editName.trim() !== editingUser.name) {
      body.name = editName.trim();
    }
    if (editRole && editRole !== editingUser.role) body.role = editRole;

    if (Object.keys(body).length === 0) {
      setEditingUser(null);
      return;
    }

    if (await patchUser(editingUser.id, body, "User updated")) {
      setEditingUser(null);
    }
  }

  async function handleResetPassword() {
    if (!resetTarget || resetPassword.length < MIN_PASSWORD_LENGTH) return;
    if (
      await patchUser(resetTarget.id, { password: resetPassword }, "Password reset")
    ) {
      setResetPassword("");
      setResetTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const result = await apiJson<{ message?: string; deactivated?: boolean }>(
        `/api/users/${deleteTarget.id}`,
        "DELETE"
      );
      toast.success(result.message ?? "User removed");
      await fetchUsers();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleAcknowledge(ticketId: string) {
    setAcknowledgingId(ticketId);
    try {
      await apiJson(`/api/tickets/${ticketId}`, "PATCH", {
        status: "ACKNOWLEDGED",
      });
      toast.success("Ticket acknowledged");
      await fetchClosedTickets();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAcknowledgingId(null);
    }
  }

  const deleteTargetHasHistory =
    deleteTarget?._count &&
    deleteTarget._count.createdTickets + deleteTarget._count.managedTickets > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage users and review completed tasks
          </p>
        </div>
        {activeTab === "users" && (
          <Link href="/admin/users/new">
            <Button className="gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
              Add User
            </Button>
          </Link>
        )}
      </div>

      <div className="flex gap-1 border-b">
        <button
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("users")}
        >
          User Management
        </button>
        <button
          className={`relative border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "completed"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => {
            setActiveTab("completed");
            setLoadingTickets(true);
          }}
        >
          Completed Tasks
          {closedCount > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
              {closedCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === "users" && (
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <div className="relative min-w-56 flex-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <Input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search by name or email"
                className="h-9 pl-9"
                aria-label="Search users"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                if (!v) return;
                setLoading(true);
                setStatusFilter(v);
                setUserPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {userTotal} user{userTotal === 1 ? "" : "s"}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="h-6 w-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium">No users found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search or filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">User</TableHead>
                    <TableHead className="hidden sm:table-cell">Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Tickets</TableHead>
                    <TableHead className="hidden lg:table-cell">Joined</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isSelf = user.id === session?.user.id;
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3">
                            <InitialsAvatar
                              name={user.name}
                              className="h-9 w-9 text-xs"
                            />
                            <div className="min-w-0">
                              <p className="font-medium">
                                {user.name}
                                {isSelf && (
                                  <span className="ml-1.5 text-xs text-muted-foreground">
                                    (you)
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {user.email}
                              </p>
                              <p className="text-xs text-muted-foreground sm:hidden">
                                {humanizeEnum(user.role)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge
                            className={`text-xs font-medium ring-1 ${
                              roleColors[user.role] ?? roleColors.STAFF
                            }`}
                          >
                            {humanizeEnum(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.isActive ? (
                            <Badge className="bg-green-50 text-xs font-medium text-green-700 ring-1 ring-green-600/20 hover:bg-green-50 dark:bg-green-950 dark:text-green-300">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-red-50 text-xs font-medium text-red-700 ring-1 ring-red-600/20 hover:bg-red-50 dark:bg-red-950 dark:text-red-300">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                          {user._count
                            ? user._count.createdTickets +
                              user._count.managedTickets
                            : "—"}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                          {formatDate(user.createdAt)}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingUser(user);
                                setEditRole(user.role);
                                setEditName(user.name);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setResetTarget(user);
                                setResetPassword("");
                              }}
                            >
                              Reset Password
                            </Button>
                            {!isSelf && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={
                                    user.isActive
                                      ? "text-orange-600 hover:text-orange-700"
                                      : "text-green-600 hover:text-green-700"
                                  }
                                  onClick={() =>
                                    patchUser(
                                      user.id,
                                      { isActive: !user.isActive },
                                      user.isActive
                                        ? "User deactivated"
                                        : "User activated"
                                    )
                                  }
                                  disabled={saving}
                                >
                                  {user.isActive ? "Deactivate" : "Activate"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => setDeleteTarget(user)}
                                  disabled={saving}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {userPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {userPage} of {userPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={userPage <= 1 || loading}
                  onClick={() => {
                    setLoading(true);
                    setUserPage((p) => p - 1);
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={userPage >= userPages || loading}
                  onClick={() => {
                    setLoading(true);
                    setUserPage((p) => p + 1);
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {activeTab === "completed" && (
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          {loadingTickets ? (
            <div className="flex items-center justify-center py-16">
              <svg className="h-6 w-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            </div>
          ) : closedTickets.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No closed tickets awaiting acknowledgement.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">#</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="hidden sm:table-cell">Creator</TableHead>
                    <TableHead className="hidden sm:table-cell">Closed</TableHead>
                    <TableHead className="pr-4 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closedTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="pl-4">
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="font-mono text-xs font-medium text-primary hover:underline"
                        >
                          #{ticket.ticketNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="font-medium transition-colors hover:text-primary"
                        >
                          {ticket.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={ticket.severity} />
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {ticket.creator.name}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {formatDate(ticket.updatedAt)}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          size="sm"
                          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => handleAcknowledge(ticket.id)}
                          disabled={acknowledgingId === ticket.id}
                        >
                          {acknowledgingId === ticket.id
                            ? "Acknowledging..."
                            : "Acknowledge"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      <Dialog
        open={editingUser !== null}
        onOpenChange={(open) => !open && setEditingUser(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editingUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="editName" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={editRole} onValueChange={(v) => v && setEditRole(v)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {humanizeEnum(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingUser?.id === session?.user.id && editRole !== "ADMIN" && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  You cannot remove your own admin role.
                </p>
              )}
            </div>
            <Button
              onClick={handleSaveUser}
              className="w-full"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resetTarget !== null}
        onOpenChange={(open) => !open && setResetTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password: {resetTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              type="text"
              placeholder={`New password (min ${MIN_PASSWORD_LENGTH} characters)`}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              Share this with the user and ask them to change it from their
              Settings page.
            </p>
            <Button
              onClick={handleResetPassword}
              className="w-full"
              disabled={saving || resetPassword.length < MIN_PASSWORD_LENGTH}
            >
              {saving ? "Resetting..." : "Reset Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Remove ${deleteTarget?.name}?`}
        description={
          deleteTargetHasHistory
            ? "This user has tickets on record, so their account will be deactivated rather than deleted. They will no longer be able to sign in, and their history stays intact."
            : "This user has no activity on record, so their account will be permanently deleted."
        }
        confirmLabel={deleteTargetHasHistory ? "Deactivate user" : "Delete user"}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
