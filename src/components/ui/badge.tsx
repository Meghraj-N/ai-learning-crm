import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "danger";
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-border-active)] focus:ring-offset-2",
          {
            "border-transparent bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)]":
              variant === "default",
            "border-transparent bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-highest)]":
              variant === "secondary",
            "text-[var(--color-text-primary)] border-[var(--color-border)]": variant === "outline",
            "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]": variant === "success",
            "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]": variant === "warning",
            "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]": variant === "danger",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
