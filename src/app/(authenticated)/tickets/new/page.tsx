"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import InitialsAvatar from "@/components/common/Avatar";
import { apiFetch, apiJson, errorMessage, RequestError } from "@/lib/fetcher";
import { CATEGORIES, LIMITS, SEVERITIES } from "@/lib/validation";
import { humanizeEnum } from "@/lib/format";

interface UserOption {
  id: string;
  name: string;
  role: string;
}

const ROLE_ORDER = [
  "ADMIN",
  "PRINCIPAL",
  "ACADEMIC_HEAD",
  "FACILITIES_MANAGER",
  "OFFICE_MANAGER",
  "STAFF",
];

const UNASSIGNED = "__unassigned__";

export default function NewTicketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [managerId, setManagerId] = useState(UNASSIGNED);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    let cancelled = false;
    apiFetch<UserOption[]>("/api/users?minimal=true")
      .then((data) => {
        if (!cancelled) setUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Could not load the list of people to assign to.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedManager = users.find((u) => u.id === managerId);

  const groupedUsers = ROLE_ORDER.map((role) => ({
    role,
    label: humanizeEnum(role),
    users: users.filter((u) => u.role === role),
  })).filter((group) => group.users.length > 0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setFieldErrors({});

    if (!category) {
      toast.error("Please select a category.");
      return;
    }

    const form = new FormData(e.currentTarget);
    const deadline = String(form.get("deadline") ?? "");
    const dateOfOccurrence = String(form.get("dateOfOccurrence") ?? "");

    if (deadline && deadline < today) {
      setFieldErrors({ deadline: "The deadline cannot be in the past." });
      toast.error("The deadline cannot be in the past.");
      return;
    }
    if (dateOfOccurrence && dateOfOccurrence > today) {
      setFieldErrors({
        dateOfOccurrence: "The date of occurrence cannot be in the future.",
      });
      toast.error("The date of occurrence cannot be in the future.");
      return;
    }

    setLoading(true);
    try {
      const ticket = await apiJson<{ id: string }>("/api/tickets", "POST", {
        title: String(form.get("title") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(),
        category,
        severity,
        managerId: managerId === UNASSIGNED ? undefined : managerId,
        dateOfOccurrence: dateOfOccurrence || undefined,
        deadline: deadline || undefined,
      });

      toast.success("Ticket created successfully");
      router.push(`/tickets/${ticket.id}`);
      router.refresh();
    } catch (err) {
      // Field-level messages come back in `details`; show them inline rather
      // than dumping raw JSON into a toast.
      if (err instanceof RequestError && err.details) {
        setFieldErrors(err.details);
      }
      toast.error(errorMessage(err));
      setLoading(false);
    }
  }

  const fieldError = (name: string) =>
    fieldErrors[name] ? (
      <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors[name]}</p>
    ) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-2 gap-1 text-muted-foreground"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Create New Ticket</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill in the details to submit a new issue.
        </p>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                required
                maxLength={LIMITS.title}
                placeholder="Brief summary of the issue"
                className="h-10"
                aria-invalid={Boolean(fieldErrors.title)}
              />
              {fieldError("title")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={5}
                required
                maxLength={LIMITS.description}
                placeholder="Describe the issue in detail..."
                aria-invalid={Boolean(fieldErrors.description)}
              />
              {fieldError("description")}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) => v && setCategory(v)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {humanizeEnum(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldError("category")}
              </div>

              <div className="space-y-2">
                <Label>Severity</Label>
                <Select
                  value={severity}
                  onValueChange={(v) => v && setSeverity(v)}
                >
                  <SelectTrigger className="h-10">
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
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select
                  value={managerId}
                  onValueChange={(v) => v && setManagerId(v)}
                >
                  <SelectTrigger className="h-10">
                    {selectedManager ? (
                      <span className="flex items-center gap-2">
                        <InitialsAvatar
                          name={selectedManager.name}
                          className="h-5 w-5 text-[10px]"
                        />
                        {selectedManager.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {groupedUsers.map((group) => (
                      <div key={group.role}>
                        <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.label}
                        </div>
                        {group.users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
                {fieldError("managerId")}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfOccurrence">Date of Occurrence</Label>
                <Input
                  id="dateOfOccurrence"
                  name="dateOfOccurrence"
                  type="date"
                  max={today}
                  className="h-10"
                  aria-invalid={Boolean(fieldErrors.dateOfOccurrence)}
                />
                {fieldError("dateOfOccurrence")}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline (optional)</Label>
                <Input
                  id="deadline"
                  name="deadline"
                  type="date"
                  min={today}
                  className="h-10"
                  aria-invalid={Boolean(fieldErrors.deadline)}
                />
                {fieldError("deadline")}
              </div>
            </div>

            <div className="flex gap-3 border-t pt-3">
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Creating...
                  </>
                ) : (
                  "Create Ticket"
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
