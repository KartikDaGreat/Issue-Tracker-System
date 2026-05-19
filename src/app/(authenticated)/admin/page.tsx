"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TicketStatusBadge from "@/components/tickets/TicketStatusBadge";
import SeverityBadge from "@/components/tickets/SeverityBadge";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
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

const roleColors: Record<string, string> = {
  ADMIN: "bg-purple-50 text-purple-700 ring-purple-600/20",
  PRINCIPAL: "bg-blue-50 text-blue-700 ring-blue-600/20",
  ACADEMIC_HEAD: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  FACILITIES_MANAGER: "bg-amber-50 text-amber-700 ring-amber-600/20",
  OFFICE_MANAGER: "bg-teal-50 text-teal-700 ring-teal-600/20",
  STAFF: "bg-gray-50 text-gray-600 ring-gray-500/20",
};

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"users" | "completed">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [closedTickets, setClosedTickets] = useState<ClosedTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  useEffect(() => {
    if (session && session.user.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetchUsers();
  }, [session]);

  useEffect(() => {
    if (activeTab === "completed") fetchClosedTickets();
  }, [activeTab]);

  async function fetchUsers() {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  async function fetchClosedTickets() {
    setLoadingTickets(true);
    const res = await fetch("/api/tickets?status=CLOSED&limit=100");
    if (res.ok) {
      const data = await res.json();
      setClosedTickets(data.tickets);
    }
    setLoadingTickets(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    setSaving(true);
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("User deleted");
      fetchUsers();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to delete user");
    }
    setSaving(false);
  }

  async function handleUpdateRole() {
    if (!editingUser || !editRole || saving) return;
    setSaving(true);
    const res = await fetch(`/api/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: editRole }),
    });
    if (res.ok) {
      toast.success("Role updated");
      setEditingUser(null);
      fetchUsers();
    } else {
      toast.error("Failed to update role");
    }
    setSaving(false);
  }

  async function handleToggleActive(user: User) {
    if (saving) return;
    setSaving(true);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (res.ok) {
      toast.success(user.isActive ? "User deactivated" : "User activated");
      fetchUsers();
    } else {
      toast.error("Failed to update user status");
    }
    setSaving(false);
  }

  async function handleResetPassword(userId: string) {
    if (!resetPassword || resetPassword.length < 6 || saving) return;
    setSaving(true);
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPassword }),
    });
    if (res.ok) {
      toast.success("Password reset successfully");
      setResetPassword("");
    } else {
      toast.error("Failed to reset password");
    }
    setSaving(false);
  }

  async function handleAcknowledge(ticketId: string) {
    setAcknowledgingId(ticketId);
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACKNOWLEDGED" }),
    });
    if (res.ok) {
      toast.success("Ticket acknowledged");
      fetchClosedTickets();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to acknowledge ticket");
    }
    setAcknowledgingId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-6 w-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage users and review completed tasks</p>
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
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "users" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-gray-700"}`}
          onClick={() => setActiveTab("users")}
        >
          User Management
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "completed" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-gray-700"}`}
          onClick={() => setActiveTab("completed")}
        >
          Completed Tasks
        </button>
      </div>

      {activeTab === "users" && (
        <Card className="border-0 shadow-sm ring-1 ring-black/5 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Joined</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const initials = user.name.split(" ").map((n) => n[0]).join("");
                const colorClass = roleColors[user.role] || roleColors.STAFF;
                return (
                  <TableRow key={user.id}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {initials}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`ring-1 font-medium text-xs ${colorClass}`}>
                        {user.role.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Badge className="bg-green-50 text-green-700 ring-1 ring-green-600/20 hover:bg-green-50 font-medium text-xs">Active</Badge>
                      ) : (
                        <Badge className="bg-red-50 text-red-700 ring-1 ring-red-600/20 hover:bg-red-50 font-medium text-xs">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger
                            render={<Button variant="outline" size="sm" />}
                            onClick={() => {
                              setEditingUser(user);
                              setEditRole(user.role);
                            }}
                          >
                            Edit Role
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Role: {user.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <Select
                                value={editRole}
                                onValueChange={(v) => v && setEditRole(v)}
                              >
                                <SelectTrigger className="h-10">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ADMIN">Admin</SelectItem>
                                  <SelectItem value="PRINCIPAL">Principal</SelectItem>
                                  <SelectItem value="ACADEMIC_HEAD">Academic Head</SelectItem>
                                  <SelectItem value="FACILITIES_MANAGER">Facilities Manager</SelectItem>
                                  <SelectItem value="OFFICE_MANAGER">Office Manager</SelectItem>
                                  <SelectItem value="STAFF">Staff</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button onClick={handleUpdateRole} className="w-full" disabled={saving}>
                                {saving ? (
                                  <span className="flex items-center gap-2">
                                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                    Saving...
                                  </span>
                                ) : "Save Changes"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger
                            render={<Button variant="outline" size="sm" />}
                            onClick={() => setResetPassword("")}
                          >
                            Reset Password
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reset Password: {user.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <Input
                                type="text"
                                placeholder="New password (min 6 chars)"
                                value={resetPassword}
                                onChange={(e) => setResetPassword(e.target.value)}
                                className="h-10"
                              />
                              <Button
                                onClick={() => handleResetPassword(user.id)}
                                className="w-full"
                                disabled={saving || resetPassword.length < 6}
                              >
                                {saving ? (
                                  <span className="flex items-center gap-2">
                                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                    Resetting...
                                  </span>
                                ) : "Reset Password"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {user.id !== session?.user.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className={user.isActive ? "text-orange-600 hover:bg-orange-50 hover:text-orange-700" : "text-green-600 hover:bg-green-50 hover:text-green-700"}
                            onClick={() => handleToggleActive(user)}
                            disabled={saving}
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        )}

                        {user.id !== session?.user.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleDelete(user.id, user.name)}
                            disabled={saving}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {activeTab === "completed" && (
        <Card className="border-0 shadow-sm ring-1 ring-black/5 overflow-hidden">
          {loadingTickets ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <svg className="h-6 w-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                <span className="text-sm text-muted-foreground">Loading closed tickets...</span>
              </div>
            </div>
          ) : closedTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">No closed tickets awaiting acknowledgement.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="hidden sm:table-cell">Creator</TableHead>
                  <TableHead className="hidden sm:table-cell">Closed Date</TableHead>
                  <TableHead className="text-right pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closedTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="pl-4">
                      <Link href={`/tickets/${ticket.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                        #{ticket.ticketNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/tickets/${ticket.id}`} className="font-medium text-gray-900 hover:text-primary transition-colors">
                        {ticket.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={ticket.severity} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {ticket.creator.name}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {new Date(ticket.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button
                        size="sm"
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleAcknowledge(ticket.id)}
                        disabled={acknowledgingId === ticket.id}
                      >
                        {acknowledgingId === ticket.id ? (
                          <span className="flex items-center gap-1.5">
                            <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                            Acknowledging...
                          </span>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                            Acknowledge
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
