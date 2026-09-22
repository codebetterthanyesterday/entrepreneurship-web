import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Komponen Note menampilkan satu paragraf instruksi atau peringatan yang perlu
 * dibaca, bukan sekadar label.
 */
export interface NoteProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "warn" | "ok" | "hot";
}

const Note = React.forwardRef<HTMLDivElement, NoteProps>(
  ({ className, variant = "info", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "text-sm font-medium p-3 rounded-[14px] border",
          variant === "info" && "bg-sky-soft text-sky-deep border-sky-deep/20",
          variant === "warn" && "bg-warn-soft text-warn border-warn/20",
          variant === "ok" && "bg-ok-soft text-ok border-ok/20",
          variant === "hot" && "bg-hot-soft text-hot border-hot/20",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Note.displayName = "Note";

export { Note };
