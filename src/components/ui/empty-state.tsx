import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-[#272B33] bg-[#111318]/50 p-8 text-center animate-in fade-in-50",
        className
      )}
      {...props}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#181B21] border border-[#272B33]">
        <Icon className="h-6 w-6 text-[#A1A1AA]" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[#F4F4F5]">{title}</h3>
      <p className="mt-2 text-sm text-[#A1A1AA] max-w-sm">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
