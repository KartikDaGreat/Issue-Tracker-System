import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; className: string }> = {
  OPEN: {
    label: "Open",
    className:
      "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 hover:bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-400/20 dark:hover:bg-blue-950/50",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 hover:bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/20 dark:hover:bg-amber-950/50",
  },
  PENDING: {
    label: "Pending",
    className:
      "bg-orange-50 text-orange-700 ring-1 ring-orange-600/20 hover:bg-orange-50 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-400/20 dark:hover:bg-orange-950/50",
  },
  CLOSED: {
    label: "Closed",
    className:
      "bg-gray-50 text-gray-600 ring-1 ring-gray-500/20 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-400/20 dark:hover:bg-gray-900",
  },
  ACKNOWLEDGED: {
    label: "Acknowledged",
    className:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 hover:bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/20 dark:hover:bg-emerald-950/50",
  },
};

export default function TicketStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, className: "" };
  return (
    <Badge className={`text-xs font-medium ${config.className}`}>
      {config.label}
    </Badge>
  );
}
