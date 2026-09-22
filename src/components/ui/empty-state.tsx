import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Komponen EmptyState digunakan ketika tidak ada data untuk ditampilkan pada suatu halaman atau bagian,
 * seperti saat keranjang kosong atau belum ada produk.
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  emoji?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, emoji, title, description, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center text-center py-16 px-4",
          className
        )}
        {...props}
      >
        {emoji && <span className="text-5xl mb-4" aria-hidden="true">{emoji}</span>}
        <h3 className="text-lg font-semibold text-ink mb-2">{title}</h3>
        {description && <p className="text-ink-soft mb-6 max-w-sm">{description}</p>}
        {action && <div>{action}</div>}
      </div>
    );
  }
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
