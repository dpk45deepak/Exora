import clsx from "clsx";
import type { SessionRow } from "@/lib/api";

const STYLES: Record<SessionRow["status"], string> = {
  PENDING: "bg-ink-100 text-ink-500",
  ACTIVE: "bg-verify-100 text-verify-600",
  SUBMITTED: "bg-ink-100 text-ink-700",
  FLAGGED: "bg-flag-100 text-flag-600",
  CLOSED: "bg-ink-100 text-ink-500",
};

export function StatusBadge({ status }: { status: SessionRow["status"] }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-mono uppercase tracking-wide",
        STYLES[status]
      )}
    >
      {status}
    </span>
  );
}
