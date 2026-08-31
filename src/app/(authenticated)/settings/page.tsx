"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import InitialsAvatar from "@/components/common/Avatar";
import { apiJson, errorMessage } from "@/lib/fetcher";
import { humanizeEnum } from "@/lib/format";

const MIN_PASSWORD_LENGTH = 8;

export default function SettingsPage() {
  const { data: session } = useSession();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("The two new passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      await apiJson("/api/users/me/password", "POST", {
        currentPassword,
        newPassword,
      });
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and preferences.
        </p>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="label-caps text-[13px]">
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <InitialsAvatar
            name={session.user.name}
            className="h-12 w-12 text-base"
          />
          <div className="min-w-0">
            <p className="font-medium">{session.user.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {session.user.email}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {humanizeEnum(session.user.role)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="label-caps text-[13px]">
            Change password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-10"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  The passwords do not match.
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={
                saving ||
                !currentPassword ||
                !newPassword ||
                newPassword !== confirmPassword
              }
            >
              {saving ? "Saving..." : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
