import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Komponen Input digunakan untuk mengumpulkan data teks singkat dari pengguna.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    // The hint and the error message sit outside the field, so without these a
    // screen reader reads the label and stops — the user is told the value is
    // wrong by a red border they cannot see.
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;
    const describedBy = error ? errorId : hint ? hintId : undefined;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "bg-white border-[1.5px] border-line rounded-[14px] min-h-[50px] px-4 text-ink text-[16px] placeholder:text-ink-soft transition-colors focus:border-pink",
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
Input.displayName = "Input";

export { Input };
