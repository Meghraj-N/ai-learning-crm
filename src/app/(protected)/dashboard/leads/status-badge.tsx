import type { LeadStatus } from "@/types/crm";

export function statusBadgeClasses(status: LeadStatus): string {
  switch (status) {
    case "new":
      return "bg-blue-100 text-blue-700";
    case "contacted":
      return "bg-amber-100 text-amber-700";
    case "qualified":
      return "bg-purple-100 text-purple-700";
    case "converted":
      return "bg-green-100 text-green-700";
    case "lost":
      return "bg-zinc-100 text-zinc-500";
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