import { Badge } from "@/components/ui/badge";

const severityConfig: Record<string, { label: string; dot: string; className: string }> = {
  LOW: { label: "Low", dot: "bg-green-500", className: "bg-green-50 text-green-700 ring-1 ring-green-600/20 hover:bg-green-50" },
  MEDIUM: { label: "Medium", dot: "bg-blue-500", className: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 hover:bg-blue-50" },
  HIGH: { label: "High", dot: "bg-orange-500", className: "bg-orange-50 text-orange-700 ring-1 ring-orange-600/20 hover:bg-orange-50" },
  CRITICAL: { label: "Critical", dot: "bg-red-500", className: "bg-red-50 text-red-700 ring-1 ring-red-600/20 hover:bg-red-50" },
};

export default function SeverityBadge({ severity }: { severity: string }) {
  const config = severityConfig[severity] || { label: severity, dot: "bg-gray-400", className: "" };
  return (
    <Badge className={`gap-1.5 font-medium text-xs ${config.className}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </Badge>
  );
}
