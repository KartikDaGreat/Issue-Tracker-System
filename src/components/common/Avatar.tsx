import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Initials badge. Replaces six copies of
 * `name.split(" ").map((n) => n[0]).join("")`, which rendered "AundefinedB"
 * whenever a name contained a double space.
 */
export default function InitialsAvatar({
  name,
  className,
  tone = "primary",
}: {
  name: string | null | undefined;
  className?: string;
  tone?: "primary" | "success" | "muted";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    muted: "bg-muted text-muted-foreground",
  } as const;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        tones[tone],
        className ?? "h-6 w-6 text-[10px]"
      )}
    >
      {getInitials(name)}
    </span>
  );
}
