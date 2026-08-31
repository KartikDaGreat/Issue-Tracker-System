"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch, apiJson } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";

interface Notification {
  id: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationResponse {
  notifications: Notification[];
  unreadCount: number;
}

/** How often to re-check for new notifications while the tab is visible. */
const POLL_INTERVAL_MS = 60_000;

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [acting, setActing] = useState(false);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiFetch<NotificationResponse>("/api/notifications");
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // A failed poll is not worth interrupting the user over.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // The bell used to fetch exactly once on mount, so it stayed stale for the
    // whole session. Poll instead, and only while the tab is actually visible.
    const tick = () => {
      if (!cancelled && document.visibilityState === "visible") {
        void fetchNotifications();
      }
    };

    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [fetchNotifications]);

  async function markAllRead(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (acting) return;
    setActing(true);
    try {
      await apiJson("/api/notifications", "PATCH");
      // Reflect the change immediately rather than waiting for a round-trip.
      setNotifications((current) => current.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      await fetchNotifications();
    } finally {
      setActing(false);
    }
  }

  async function handleClick(notification: Notification) {
    if (acting) return;
    setActing(true);
    try {
      if (!notification.read) {
        setNotifications((current) =>
          current.map((n) =>
            n.id === notification.id ? { ...n, read: true } : n
          )
        );
        setUnreadCount((count) => Math.max(0, count - 1));
        await apiJson(`/api/notifications/${notification.id}`, "PATCH", {
          read: true,
        });
      }
      if (notification.link) router.push(notification.link);
    } catch {
      await fetchNotifications();
    } finally {
      setActing(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        className="relative inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={acting}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              {acting ? "Updating..." : "Mark all read"}
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center py-8">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              <p className="mt-2 text-sm text-muted-foreground">
                No notifications
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => handleClick(n)}
                className={`cursor-pointer px-3 py-2.5 ${!n.read ? "bg-primary/5" : ""}`}
              >
                <div className="flex gap-2.5">
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                  <div className={`flex flex-col gap-0.5 ${n.read ? "pl-4" : ""}`}>
                    <span className="text-sm leading-snug">{n.message}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(n.createdAt)}
                    </span>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
