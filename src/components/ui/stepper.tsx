"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Announced on the group, since the two buttons only say "kurangi" / "tambah". */
  label?: string;
}

/**
 * Komponen Stepper untuk mengubah jumlah, misalnya banyaknya porsi di keranjang.
 *
 * One segmented control rather than three separate buttons with gaps between
 * them: the minus, the figure and the plus belong to the same thing, and drawing
 * them as one pill with hairline divisions says so. It also takes noticeably less
 * width, which is what lets a cart line fit a name, a quantity and a price on a
 * phone without wrapping.
 *
 * Each half stays 44px wide — the project's touch-target floor — and the figure
 * is tabular so the control does not change width between 9 and 10.
 */
export function Stepper({ value, onChange, min = 1, max = 99, disabled, label }: StepperProps) {
  const atMin = disabled || value <= min;
  const atMax = disabled || value >= max;

  const side =
    "w-[44px] h-[42px] flex items-center justify-center text-ink transition-colors " +
    "hover:bg-cream disabled:text-ink-soft/40 disabled:hover:bg-transparent disabled:cursor-not-allowed";

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-[12px] border-[1.5px] border-line bg-white",
        disabled && "opacity-70",
      )}
    >
      <button
        type="button"
        disabled={atMin}
        onClick={() => onChange(value - 1)}
        aria-label="Kurangi"
        className={cn(side, "border-r border-line")}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8H13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>

      <span
        aria-live="polite"
        className="flex min-w-[38px] items-center justify-center px-1 text-[15px] font-semibold text-ink tabular-nums"
      >
        {value}
      </span>

      <button
        type="button"
        disabled={atMax}
        onClick={() => onChange(value + 1)}
        aria-label="Tambah"
        className={cn(side, "border-l border-line")}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 3V13M3 8H13"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
