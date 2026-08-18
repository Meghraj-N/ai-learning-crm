import type { LeadStatus } from "@/types/crm";

export function statusBadgeClasses(status: LeadStatus): string {
  switch (status) {
    case "new":
      return "bg-[var(--color-primary)]/10 text-[var(--color-text-primary)] border-[var(--color-primary)]/20 border";
    case "contacted":
      return "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)] border";
    case "qualified":
      return "bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-info-border)] border";
    case "converted":
      return "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)] border";
    case "lost":
      return "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] border-[var(--color-border)] border";
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