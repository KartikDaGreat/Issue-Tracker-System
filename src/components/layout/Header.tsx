"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NotificationBell from "./NotificationBell";

export default function Header() {
  const { data: session } = useSession();

  if (!session) return null;

  const initials = session.user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Image
            src="/logo.png"
            alt="KVMHSS"
            width={160}
            height={36}
            className="h-8 sm:h-9 w-auto shrink-0"
            priority
          />
          <span className="text-gray-300 text-2xl font-thin select-none hidden sm:inline">|</span>
          <span className="text-sm sm:text-base font-semibold tracking-tight truncate hidden sm:inline">Ticket Tracker</span>
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials}
              </span>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-none">{session.user.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {session.user.role.replace(/_/g, " ")}
                </p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hidden text-gray-400 md:block"><path d="m6 9 6 6 6-6"/></svg>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="border-b px-2 py-2 md:hidden">
                <p className="text-sm font-medium">{session.user.name}</p>
                <p className="text-xs text-muted-foreground">{session.user.role.replace(/_/g, " ")}</p>
              </div>
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-red-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
