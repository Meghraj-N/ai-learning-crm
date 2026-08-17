import type { CourseStatus } from "@/types/crm";

export function courseStatusBadgeClasses(status: CourseStatus): string {
  switch (status) {
    case "draft":
      return "bg-zinc-100 text-zinc-600";
    case "published":
      return "bg-green-100 text-green-700";
    case "archived":
      return "bg-red-100 text-red-700";
  }
}

export function enrollmentBadgeClasses(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "paused":
      return "bg-amber-100 text-amber-700";
    case "completed":
      return "bg-blue-100 text-blue-700";
    case "cancelled":
      return "bg-zinc-100 text-zinc-500";
    default:
      return "bg-zinc-100 text-zinc-500";
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
