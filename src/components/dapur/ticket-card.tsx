"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatWaiting, minutesWaiting, timerTone, type TimerTone } from "@/lib/kitchen-timer";
import { cn } from "@/lib/utils";
import type { KitchenStatus, KitchenTicket } from "@/types/order-view";

/** Where a ticket can go from the board: back a stage, on a stage, or away. */
export type TicketTarget = KitchenStatus | "DONE";

/** One button on a ticket. */
export interface TicketAction {
  to: TicketTarget;
  label: string;
  variant: "go" | "done" | "flat";
  /** The way back. Rendered narrow, on the left. */
  isUndo?: boolean;
}

/**
 * What each status offers.
 *
 * Every stage has a way back. A mis-tap is real — wet hands, a queue building
 * up, a tablet propped at an angle — and without a way home one wrong tap
 * leaves the order's status wrong for the rest of the event, with the customer
 * screen and the counter both repeating the mistake.
 */
export const TICKET_ACTIONS: Readonly<Record<KitchenStatus, readonly TicketAction[]>> = {
  IN_QUEUE: [{ to: "IN_PROGRESS", label: "Mulai racik", variant: "go" }],
  IN_PROGRESS: [
    { to: "IN_QUEUE", label: "Balikin", variant: "flat", isUndo: true },
    { to: "READY", label: "Tandai siap", variant: "done" },
  ],
  READY: [
    { to: "IN_PROGRESS", label: "Balikin", variant: "flat", isUndo: true },
    { to: "DONE", label: "Sudah diserahkan", variant: "flat" },
  ],
};

/** The left edge says at a glance what this ticket is. */
const STATUS_EDGE: Readonly<Record<KitchenStatus, string>> = {
  IN_QUEUE: "border-l-sky",
  IN_PROGRESS: "border-l-warn",
  READY: "border-l-ok",
};

const TIMER_TONE_CLASS: Readonly<Record<TimerTone, string>> = {
  neutral: "bg-cream text-ink-soft",
  warn: "bg-warn-soft text-warn",
  late: "bg-hot-soft text-hot",
};

const CHANNEL_LABEL = {
  PREORDER: "Preorder",
  ONSITE: "Beli di tempat",
} as const;

export interface TicketCardProps {
  ticket: KitchenTicket;
  /** Recomputed by the board every 30s, so the timer moves without a poll. */
  now: number;
  /** False for a role that may look at the board but not move tickets. */
  canAct: boolean;
  pendingTo: TicketTarget | null;
  onAction: (ticket: KitchenTicket, to: TicketTarget) => void;
}

export function TicketCard({ ticket, now, canAct, pendingTo, onAction }: TicketCardProps) {
  const minutes = minutesWaiting(ticket, now);
  const tone = timerTone(minutes, ticket.status);

  // Only lateness overrides the status colour, and only for a ticket the
  // kitchen still owes — see `timerTone`.
  const edge = tone === "late" ? "border-l-hot" : STATUS_EDGE[ticket.status];

  const cooking = ticket.items.filter((item) => item.needsPrep);
  const alreadyMade = ticket.items.filter((item) => !item.needsPrep);
  const actions = TICKET_ACTIONS[ticket.status];

  return (
    <article
      className={cn(
        "bg-white border-[1.5px] border-line border-l-[5px] rounded-[16px] p-3.5 flex flex-col gap-2.5",
        "motion-safe:animate-fade-in",
        edge,
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-[family-name:var(--font-display)] text-[21px] font-semibold text-ink leading-none">
          {ticket.orderNumber}
        </span>

        <span
          className={cn(
            "flex-none text-[12px] font-bold px-2 py-1 rounded-full tabular-nums",
            TIMER_TONE_CLASS[tone],
          )}
        >
          {formatWaiting(minutes)}
        </span>
      </div>

      <div className="flex items-center gap-2 -mt-1">
        <Badge variant={ticket.channel === "PREORDER" ? "info" : "muted"} className="flex-none">
          {CHANNEL_LABEL[ticket.channel]}
        </Badge>
        <span className="text-[13px] text-ink-soft truncate">{ticket.customerName}</span>
      </div>

      {/* The only thing on this card anyone has to cook from. Quantity is the
          most expensive thing to misread, so it is the largest thing here. */}
      <ul className="flex flex-col gap-1.5">
        {cooking.map((item, index) => (
          <li key={`${item.name}-${index}`} className="flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-display)] text-[21px] font-semibold text-pink leading-none tabular-nums flex-none">
              {item.quantity}&times;
            </span>
            <span className="text-[16.5px] font-semibold text-ink leading-snug">{item.name}</span>
          </li>
        ))}
      </ul>

      {alreadyMade.length > 0 && (
        // Demoted on purpose: these are not the kitchen's work, and mixing them
        // in with the cooking lines is how the wrong thing gets made.
        <p className="text-[12px] text-ink-soft border-t border-dashed border-line pt-2">
          Tanpa racik, kasir yang siapkan:{" "}
          {alreadyMade.map((item) => `${item.quantity}× ${item.name}`).join(", ")}
        </p>
      )}

      {ticket.notes && (
        <p className="text-[13px] font-medium bg-warn-soft text-warn border border-warn/20 rounded-[12px] p-2.5">
          {ticket.notes}
        </p>
      )}

      {canAct ? (
        <div className="flex gap-2">
          {actions.map((action) => (
            <Button
              key={action.to}
              variant={action.variant}
              size="sm"
              // Both buttons stay big enough for a hurried tap; the way back is
              // narrower than the way forward so they are told apart by feel.
              className={cn("min-h-[54px]", action.isUndo ? "basis-[40%] flex-none" : "flex-1")}
              isLoading={pendingTo === action.to}
              disabled={pendingTo !== null}
              onClick={() => onAction(ticket, action.to)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : (
        <Button variant="flat" size="sm" className="min-h-[54px]" fullWidth disabled>
          Cuma tim dapur yang bisa gerakin tiket
        </Button>
      )}
    </article>
  );
}
