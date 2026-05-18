import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 hover:bg-blue-50" },
  IN_PROGRESS: { label: "In Progress", className: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 hover:bg-amber-50" },
  PENDING: { label: "Pending", className: "bg-orange-50 text-orange-700 ring-1 ring-orange-600/20 hover:bg-orange-50" },
  CLOSED: { label: "Closed", className: "bg-gray-50 text-gray-600 ring-1 ring-gray-500/20 hover:bg-gray-50" },
};

export default function TicketStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, className: "" };
  return <Badge className={`font-medium text-xs ${config.className}`}>{config.label}</Badge>;
}
