"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      // The bell polls for notifications itself; don't also refetch the
      // session on every window focus.
      refetchOnWindowFocus={false}
    >
      {children}
      <Toaster position="top-right" richColors closeButton />
    </SessionProvider>
  );
}
