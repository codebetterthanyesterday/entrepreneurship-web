"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Komponen Switch adalah sakelar on/off untuk pengaturan yang langsung tersimpan,
 * misalnya membuka atau menutup kanal preorder.
 */
export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  "aria-label": string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative w-[56px] h-[32px] rounded-full flex-none transition-colors duration-200",
          checked ? "bg-ok" : "bg-line",
          disabled && "opacity-60 cursor-not-allowed",
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-[3px] left-[3px] w-[26px] h-[26px] rounded-full bg-white shadow-sm",
            "transition-transform duration-200 motion-reduce:transition-none",
            checked ? "translate-x-[24px]" : "translate-x-0",
          )}
        />
      </button>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
