import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Komponen Chip digunakan untuk filter atau pilihan tunggal/ganda berukuran kecil,
 * misalnya untuk filter kategori produk.
 */
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, active, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // 44px, not 40: the project's own touch-target floor.
          "inline-flex items-center justify-center px-4 rounded-full min-h-[44px] text-sm font-medium transition-colors",
          active
            ? "bg-pink-deep text-white"
            : "bg-white border-[1.5px] border-line text-ink-soft hover:bg-cream",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Chip.displayName = "Chip";

export { Chip };
