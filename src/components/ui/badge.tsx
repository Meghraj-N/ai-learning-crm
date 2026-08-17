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
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          {
            "border-transparent bg-[#6366F1] text-white hover:bg-[#4F46E5]":
              variant === "default",
            "border-transparent bg-[#272B33] text-[#F4F4F5] hover:bg-[#272B33]/80":
              variant === "secondary",
            "text-[#F4F4F5] border-[#272B33]": variant === "outline",
            "border-transparent bg-emerald-500/15 text-emerald-500": variant === "success",
            "border-transparent bg-amber-500/15 text-amber-500": variant === "warning",
            "border-transparent bg-red-500/15 text-red-500": variant === "danger",
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
