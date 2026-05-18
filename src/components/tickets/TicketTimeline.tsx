import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimelineEvent {
  id: string;
  type: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { id: string; name: string };
}

function eventDescription(event: TimelineEvent): string {
  switch (event.type) {
    case "CREATED":
      return `${event.user.name} created this ticket`;
    case "STATUS_CHANGE":
      return `${event.user.name} changed ${event.oldValue} → ${event.newValue}`;
    case "REASSIGNED":
      return `${event.user.name} reassigned from ${event.oldValue} to ${event.newValue}`;
    case "COMMENT":
      return `${event.user.name} added a comment`;
    default:
      return `${event.user.name} performed an action`;
  }
}

const typeIcons: Record<string, { bg: string; icon: React.ReactNode }> = {
  CREATED: {
    bg: "bg-green-100 text-green-600",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>,
  },
  STATUS_CHANGE: {
    bg: "bg-blue-100 text-blue-600",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>,
  },
  REASSIGNED: {
    bg: "bg-purple-100 text-purple-600",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  COMMENT: {
    bg: "bg-gray-100 text-gray-500",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>,
  },
};

export default function TicketTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm ring-1 ring-black/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {events.map((event, i) => {
            const iconConfig = typeIcons[event.type] || typeIcons.COMMENT;
            return (
              <div key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full ${iconConfig.bg}`}>
                    {iconConfig.icon}
                  </div>
                  {i < events.length - 1 && (
                    <div className="w-px flex-1 bg-gray-200 my-1" />
                  )}
                </div>
                <div className="pb-5 pt-0.5">
                  <p className="text-sm text-gray-700">{eventDescription(event)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
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
