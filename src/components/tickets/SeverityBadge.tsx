import { Badge } from "@/components/ui/badge";

const severityConfig: Record<
  string,
  { label: string; dot: string; className: string }
> = {
  LOW: {
    label: "Low",
    dot: "bg-green-500",
    className:
      "bg-green-50 text-green-700 ring-1 ring-green-600/20 hover:bg-green-50 dark:bg-green-950/50 dark:text-green-300 dark:ring-green-400/20 dark:hover:bg-green-950/50",
  },
  MEDIUM: {
    label: "Medium",
    dot: "bg-blue-500",
    className:
      "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 hover:bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-400/20 dark:hover:bg-blue-950/50",
  },
  HIGH: {
    label: "High",
    dot: "bg-orange-500",
    className:
      "bg-orange-50 text-orange-700 ring-1 ring-orange-600/20 hover:bg-orange-50 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-400/20 dark:hover:bg-orange-950/50",
  },
  CRITICAL: {
    label: "Critical",
    dot: "bg-red-500",
    className:
      "bg-red-50 text-red-700 ring-1 ring-red-600/20 hover:bg-red-50 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-400/20 dark:hover:bg-red-950/50",
  },
};

export default function SeverityBadge({ severity }: { severity: string }) {
  const config = severityConfig[severity] ?? {
    label: severity,
    dot: "bg-muted-foreground",
    className: "",
  };
  return (
    <Badge className={`gap-1.5 text-xs font-medium ${config.className}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </Badge>
  );
}
