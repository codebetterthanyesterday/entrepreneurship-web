import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Komponen Textarea digunakan untuk mengumpulkan data teks panjang dari pengguna.
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id || generatedId;
    // The hint and the error message sit outside the field, so without these a
    // screen reader reads the label and stops — the user is told the value is
    // wrong by a red border they cannot see.
    const hintId = `${textareaId}-hint`;
    const errorId = `${textareaId}-error`;
    const describedBy = error ? errorId : hint ? hintId : undefined;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "bg-white border-[1.5px] border-line rounded-[14px] min-h-[100px] p-4 text-ink text-[16px] placeholder:text-ink-soft transition-colors focus:border-pink resize-y",
            error && "border-hot focus:border-hot",
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-sm text-ink-soft">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-sm text-hot">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
