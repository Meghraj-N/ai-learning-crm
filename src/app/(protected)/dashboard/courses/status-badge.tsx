import type { CourseStatus } from "@/types/crm";

export function courseStatusBadgeClasses(status: CourseStatus): string {
  switch (status) {
    case "draft":
      return "bg-[var(--color-surface-highest)] text-[var(--color-text-secondary)] border-[var(--color-border)] border";
    case "published":
      return "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)] border";
    case "archived":
      return "bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20 border";
  }
}

export function enrollmentBadgeClasses(status: string): string {
  switch (status) {
    case "active":
      return "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)] border";
    case "paused":
      return "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)] border";
    case "completed":
      return "bg-[var(--color-primary)]/10 text-[var(--color-text-primary)] border-[var(--color-primary)]/20 border";
    case "cancelled":
      return "bg-[var(--color-surface-highest)] text-[var(--color-text-secondary)] border-[var(--color-border)] border";
    default:
      return "bg-[var(--color-surface-highest)] text-[var(--color-text-secondary)] border-[var(--color-border)] border";
  }
}

export function StatusBadge({ status }: { status: CourseStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${courseStatusBadgeClasses(status)}`}
    >
      {status}
    </span>
  );
}
