import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState as BaseEmptyState } from "@/components/ui/empty-state";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function AnalyticsSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-6 rounded-xl border border-[#272B33] bg-[#111318] p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[#F4F4F5] tracking-tight">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-[#A1A1AA]">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <Card className="bg-[#181B21] border-transparent">
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-[#A1A1AA]">
          {label}
        </p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-[#F4F4F5]">{value}</p>
        {sub && <p className="mt-1 text-xs font-medium text-[#71717A]">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{children}</div>
  );
}

export function ProgressBar({
  percent,
  tone = "green",
}: {
  percent: number;
  tone?: "green" | "amber" | "zinc" | "indigo";
}) {
  const barColor =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : tone === "indigo"
        ? "bg-[#6366F1]"
        : "bg-[#71717A]";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#272B33]">
      <div
        className={cn("h-full rounded-full transition-all duration-500", barColor)}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <BaseEmptyState
      icon={Info}
      title="No data available"
      description={message}
      className="min-h-[200px]"
    />
  );
}