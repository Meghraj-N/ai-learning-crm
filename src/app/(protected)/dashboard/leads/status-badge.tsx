import type { LeadStatus } from "@/types/crm";

export function statusBadgeClasses(status: LeadStatus): string {
  switch (status) {
    case "new":
      return "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20";
    case "contacted":
      return "bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/20";
    case "qualified":
      return "bg-[var(--color-accent-violet)]/10 text-[var(--color-accent-violet)] border-[var(--color-accent-violet)]/20";
    case "converted":
      return "bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20";
    case "lost":
      return "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] border-[var(--color-border)]";
  }
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClasses(status)}`}
    >
      {status}
    </span>
  );
}