import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "confirmed" | "pending" | "cancelled" | "completed";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn("status-badge", {
        "status-confirmed": status === "confirmed",
        "status-pending": status === "pending",
        "status-cancelled": status === "cancelled",
        "status-completed": status === "completed",
      })}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
