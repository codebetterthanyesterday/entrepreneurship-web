"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { buildTimeline } from "@/lib/order-timeline";
import type { OrderStatus } from "@/types/order";

export interface OrderTimelineProps {
  status: OrderStatus;
  needsPrep: boolean;
}

/**
 * Where the order has got to.
 *
 * Numbered circles joined by a thick bar is the stock "stepper" look, and it puts
 * the loudest thing on the page — four filled rings — on the part nobody reads.
 * What someone actually wants here is one line: which stage is happening now. So
 * the rule is a hairline, the marks are small dots, and weight is spent on the
 * current step's label instead.
 *
 * `position` from `buildTimeline` is deliberately unused: the order of the list
 * already says it, and printing it again inside a dot was the decoration this
 * replaces.
 */
export function OrderTimeline({ status, needsPrep }: OrderTimelineProps) {
  const steps = buildTimeline(status, needsPrep);

  return (
    <ol className="relative">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const done = step.state === "done";
        const current = step.state === "current";

        return (
          <li
            key={step.id}
            aria-current={current ? "step" : undefined}
            className={cn("relative pl-7", !isLast && "pb-6")}
          >
            {/* The rule, drawn per item so the colour can change at the step the
                order has actually reached. */}
            {!isLast && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[4.5px] top-[14px] bottom-0 w-px",
                  done ? "bg-pink" : "bg-line",
                )}
              />
            )}

            <span
              aria-hidden="true"
              className={cn(
                "absolute left-0 top-[7px] rounded-full transition-colors",
                current
                  ? // The one mark that is allowed to be loud, with a ring so it
                    // reads as "here" rather than just "another dot".
                    "h-2.5 w-2.5 bg-pink-deep ring-4 ring-pink-soft"
                  : done
                    ? "h-2.5 w-2.5 bg-pink"
                    : "h-2.5 w-2.5 border-[1.5px] border-line bg-white",
              )}
            />

            <span className="block">
              <b
                className={cn(
                  "text-[14.5px] leading-snug",
                  current ? "text-ink" : done ? "font-semibold text-ink" : "font-semibold text-ink-soft",
                )}
              >
                {step.title}
              </b>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-soft">
                {step.state === "pending" ? "Belum sampai tahap ini" : step.detail}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
