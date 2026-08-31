"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Only same-origin relative paths are accepted as a post-login destination, so
 * a crafted `?callbackUrl=https://evil.example` cannot turn the login form into
 * an open redirect.
 */
function safeCallbackUrl(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw.startsWith("/login")) return "/dashboard";
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (res?.ok) {
      // The proxy records where the user was headed; honour it instead of
      // always dumping them on the dashboard.
      router.push(callbackUrl);
      router.refresh();
      return;
    }

    // The credentials provider throws a specific message when rate-limited.
    const isRateLimited = res?.error?.includes("Too many sign-in attempts");
    setError(
      isRateLimited
        ? "Too many sign-in attempts. Please wait a few minutes and try again."
        : "Invalid email or password."
    );
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <Image
            src="/logo.png"
            alt="KV Matric Higher Secondary School"
            width={320}
            height={80}
            className="mx-auto mb-4 h-20 w-auto"
            priority
          />
          <h1 className="text-3xl font-bold text-foreground">
            Ticket Tracker
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            KVMHSS Issue Tracking System
          </p>
        </div>
        <Card className="border-0 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign in to your account</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@school.com"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="h-10"
                />
              </div>
              <Button
                type="submit"
                className="h-10 w-full text-sm font-medium"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background" />
      }
    >
      <LoginForm />
    </Suspense>
  );
}
