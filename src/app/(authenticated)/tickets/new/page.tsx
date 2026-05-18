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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UserOption {
  id: string;
  name: string;
  role: string;
}

export default function NewTicketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [managerId, setManagerId] = useState("");

  useEffect(() => {
    fetch("/api/users?minimal=true")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const selectedManager = users.find((u) => u.id === managerId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!category) {
      toast.error("Please select a category");
      return;
    }
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      title: form.get("title"),
      description: form.get("description"),
      category,
      severity,
      managerId: managerId || undefined,
      dateOfOccurrence: form.get("dateOfOccurrence") || undefined,
    };

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const ticket = await res.json();
      toast.success("Ticket created successfully");
      router.push(`/tickets/${ticket.id}`);
    } else {
      const err = await res.json();
      toast.error(err.error ? JSON.stringify(err.error) : "Failed to create ticket");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2 gap-1 text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Create New Ticket</h1>
        <p className="mt-1 text-sm text-muted-foreground">Fill in the details to submit a new issue.</p>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-black/5">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">Title</Label>
              <Input id="title" name="title" required placeholder="Brief summary of the issue" className="h-10" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Textarea id="description" name="description" rows={4} required placeholder="Describe the issue in detail..." />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Category</Label>
                <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACADEMICS">Academics</SelectItem>
                    <SelectItem value="PARENT_ISSUES">Parent Issues</SelectItem>
                    <SelectItem value="STUDENT_ISSUES">Student Issues</SelectItem>
                    <SelectItem value="FACILITIES_ISSUES">Facilities Issues</SelectItem>
                    <SelectItem value="STAFF_ISSUES">Staff Issues</SelectItem>
                    <SelectItem value="SECURITY">Security</SelectItem>
                    <SelectItem value="TRANSPORT">Transport</SelectItem>
                    <SelectItem value="MISCELLANEOUS">Miscellaneous</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Severity</Label>
                <Select value={severity} onValueChange={(v) => v && setSeverity(v)}>
                  <SelectTrigger className="h-10">
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
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Assign To</Label>
                <Select value={managerId} onValueChange={(v) => v && setManagerId(v)}>
                  <SelectTrigger className="h-10">
                    {selectedManager ? (
                      <span className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                          {selectedManager.name.split(" ").map((n) => n[0]).join("")}
                        </span>
                        {selectedManager.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.role.replace(/_/g, " ")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfOccurrence" className="text-sm font-medium">Date of Occurrence</Label>
                <Input
                  id="dateOfOccurrence"
                  name="dateOfOccurrence"
                  type="date"
                  className="h-10"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t">
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
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
