import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, humanizeEnum } from "@/lib/format";

interface TimelineEvent {
  id: string;
  type: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { id: string; name: string };
}

/**
 * Severity, deadline and edit changes now have their own event types, so the
 * timeline can describe them precisely instead of rendering every change as a
 * bare "X changed A → B".
 */
function eventDescription(event: TimelineEvent): string {
  const who = event.user.name;
  const from = event.oldValue ? humanizeEnum(event.oldValue) : null;
  const to = event.newValue ? humanizeEnum(event.newValue) : null;

  switch (event.type) {
    case "CREATED":
      return `${who} created this ticket`;
    case "STATUS_CHANGE":
      return `${who} changed the status from ${from} to ${to}`;
    case "SEVERITY_CHANGE":
      return `${who} changed the severity from ${from} to ${to}`;
    case "DEADLINE_CHANGE":
      if (from === "none") return `${who} set the deadline to ${to}`;
      if (to === "none") return `${who} removed the deadline`;
      return `${who} moved the deadline from ${from} to ${to}`;
    case "EDITED":
      return `${who} edited the ${from ?? "ticket"}`;
    case "REASSIGNED":
      return `${who} reassigned this from ${from} to ${to}`;
    case "COMMENT":
      return `${who} added a comment`;
    case "COMMENT_DELETED":
      return `${who} deleted a comment`;
    case "ACKNOWLEDGED":
      return `${who} acknowledged this ticket`;
    default:
      return `${who} updated this ticket`;
  }
}

const iconWrap = (children: React.ReactNode) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const typeIcons: Record<string, { bg: string; icon: React.ReactNode }> = {
  CREATED: {
    bg: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400",
    icon: iconWrap(
      <>
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </>
    ),
  },
  STATUS_CHANGE: {
    bg: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    icon: iconWrap(
      <>
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  SEVERITY_CHANGE: {
    bg: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
    icon: iconWrap(
      <>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
  },
  DEADLINE_CHANGE: {
    bg: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    icon: iconWrap(
      <>
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18M8 2v4M16 2v4" />
      </>
    ),
  },
  EDITED: {
    bg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
    icon: iconWrap(
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
  },
  REASSIGNED: {
    bg: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    icon: iconWrap(
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  COMMENT: {
    bg: "bg-muted text-muted-foreground",
    icon: iconWrap(<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />),
  },
  COMMENT_DELETED: {
    bg: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
    icon: iconWrap(
      <>
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </>
    ),
  },
  ACKNOWLEDGED: {
    bg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    icon: iconWrap(
      <>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="m9 11 3 3L22 4" />
      </>
    ),
  },
};

export default function TicketTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="label-caps text-[13px]">
          Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {events.map((event, i) => {
            const iconConfig = typeIcons[event.type] ?? typeIcons.COMMENT;
            return (
              <div key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${iconConfig.bg}`}
                  >
                    {iconConfig.icon}
                  </div>
                  {i < events.length - 1 && (
                    <div className="my-1 w-px flex-1 bg-border" />
                  )}
                </div>
                <div className="pb-5 pt-0.5">
                  <p className="text-sm text-foreground/80">
                    {eventDescription(event)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(event.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
