import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Komponen Badge digunakan untuk memberikan label kecil pada sebuah item,
 * seperti status pesanan atau ketersediaan stok.
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "info" | "prep" | "ok" | "danger" | "muted";
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "info", children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider",
          variant === "info" && "bg-sky-soft text-sky-deep",
          variant === "prep" && "bg-warn-soft text-warn",
          variant === "ok" && "bg-ok-soft text-ok",
          variant === "danger" && "bg-hot-soft text-hot",
          variant === "muted" && "bg-cream text-ink-soft",
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
