import type { CourseStatus } from "@/types/crm";

export function courseStatusBadgeClasses(status: CourseStatus): string {
  switch (status) {
    case "draft":
      return "bg-[var(--color-surface-highest)] text-[var(--color-text-secondary)]";
    case "published":
      return "bg-[var(--color-success)]/10 text-[var(--color-success)]";
    case "archived":
      return "bg-[var(--color-destructive)]/10 text-[var(--color-destructive)]";
  }
}

export function enrollmentBadgeClasses(status: string): string {
  switch (status) {
    case "active":
      return "bg-[var(--color-success)]/10 text-[var(--color-success)]";
    case "paused":
      return "bg-[var(--color-warning)]/10 text-[var(--color-warning)]";
    case "completed":
      return "bg-[var(--color-primary)]/10 text-[var(--color-primary)]";
    case "cancelled":
      return "bg-[var(--color-surface-highest)] text-[var(--color-text-secondary)]";
    default:
      return "bg-[var(--color-surface-highest)] text-[var(--color-text-secondary)]";
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
