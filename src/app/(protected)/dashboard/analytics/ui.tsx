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
    <div className="mt-6 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] tracking-tight">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>}
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
    <Card className="transition-all duration-300 hover:border-[var(--color-border-active)] hover:bg-[var(--color-surface-elevated)] bg-[var(--color-surface)]">
      <CardContent className="p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
          {label}
        </p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">{value}</p>
        {sub && <p className="mt-1 text-xs font-medium text-[var(--color-text-muted)]">{sub}</p>}
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
      ? "bg-[var(--color-success)]"
      : tone === "amber"
        ? "bg-[var(--color-warning)]"
        : tone === "indigo"
        ? "bg-[var(--color-primary)]"
        : "bg-[var(--color-text-muted)]";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-highest)]">
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