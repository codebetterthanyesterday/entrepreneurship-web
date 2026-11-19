"use client";

import * as React from "react";
import { buildTimeline } from "@/lib/order-timeline";
import type { OrderStatus } from "@/types/order";

export interface OrderTimelineProps {
  status: OrderStatus;
  needsPrep: boolean;
  /** Taken to the customer rather than collected (see `isDelivered`). */
  delivered?: boolean;
}

/**
 * Where the order has got to, as the design's checkpoints: one square marker
 * per stage, joined by a rail that turns red up to the stage the order is on.
 *
 * Mobile-first: on a phone the checkpoints run down the page with the rail on
 * the left, which is the only way five of them fit with their descriptions;
 * from the desktop breakpoint they sit in a row. The switch is `.k-tl` in
 * `kingdom.css` — the markup is the same list either way.
 *
 * The stage number is printed inside its marker, so a finished stage shows a
 * tick instead and the current one is the only filled red square. A stage the
 * order has not reached keeps its title but not its detail: telling someone to
 * "come to the booth" two stages early is how they turn up early.
 */
export function OrderTimeline({ status, needsPrep, delivered = false }: OrderTimelineProps) {
  const steps = buildTimeline(status, needsPrep, delivered);

  return (
    <ol className="k-tl">
      {steps.map((step, index) => {
        const current = step.state === "current";

        return (
          <li
            key={step.id}
            data-state={step.state}
            aria-current={current ? "step" : undefined}
            className="k-tl-step"
          >
            <span aria-hidden="true" className="k-tl-dot">
              {step.state === "done" ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                index + 1
              )}
            </span>

            <span className="block min-w-0">
              <span aria-hidden="true" className="k-tl-label">
                Stage {String(index + 1).padStart(2, "0")}
                {current && <span className="k-tag k-tag-yellow k-tag-flat ml-2 !text-[9px]">Aktif</span>}
              </span>
              <b className="k-tl-title">{step.title}</b>
              <span className="k-tl-detail">
                {step.state === "pending" ? "Belum sampai tahap ini" : step.detail}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
