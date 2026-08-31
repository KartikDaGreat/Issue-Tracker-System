"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { apiJson, errorMessage, RequestError } from "@/lib/fetcher";
import { ROLE_LABELS, labelFor } from "@/lib/format";
import { LIMITS, ROLES } from "@/lib/validation";

const MIN_PASSWORD_LENGTH = 8;

export default function NewUserPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("STAFF");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Redirecting during render is a React violation; do it as an effect.
  // The proxy already blocks non-admins, so this is only a fallback.
  useEffect(() => {
    if (session && session.user.role !== "ADMIN") router.push("/dashboard");
  }, [session, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      role,
    };

    try {
      await apiJson("/api/users", "POST", body);
      toast.success("User created successfully");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      if (err instanceof RequestError && err.details) setFieldErrors(err.details);
      toast.error(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2 gap-1 text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          Back
        </Button>
        <h1 className="text-2xl font-bold">Create New User</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add a new user to the system.</p>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
              <Input id="name" name="name" required maxLength={LIMITS.name} placeholder="Vaneetha V" className="h-10" />
              {fieldErrors.name && <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input id="email" name="email" type="email" required maxLength={LIMITS.email} placeholder="name@school.com" className="h-10" />
              {fieldErrors.email && <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Role</Label>
              <Select value={role} onValueChange={(v) => v && setRole(v)}>
                <SelectTrigger className="h-10">
                  {labelFor(ROLE_LABELS, role)}
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {labelFor(ROLE_LABELS, r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-3 border-t">
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Creating...
                  </>
                ) : (
                  "Create User"
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
