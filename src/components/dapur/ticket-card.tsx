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

/**
 * The top edge says at a glance what this ticket is: the same colour as its
 * column's dot and its tab (`--col` in `staff.css`).
 */
export const STATUS_COLOR: Readonly<Record<KitchenStatus, string>> = {
  IN_QUEUE: "var(--s-sky-deep)",
  IN_PROGRESS: "var(--k-gold)",
  READY: "var(--k-grass)",
};

const TIMER_TONE_CLASS: Readonly<Record<TimerTone, string>> = {
  neutral: "",
  warn: "s-timer-warn",
  late: "s-timer-hot",
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
  const edge = tone === "late" ? "var(--s-hot)" : STATUS_COLOR[ticket.status];

  const cooking = ticket.items.filter((item) => item.needsPrep);
  const alreadyMade = ticket.items.filter((item) => !item.needsPrep);
  const actions = TICKET_ACTIONS[ticket.status];

  return (
    <article
      className="s-ticket p-3 flex flex-col gap-2.5 motion-safe:animate-fade-in"
      style={{ "--col": edge } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="s-ticket-no">{ticket.orderNumber}</span>

        <span className={cn("s-timer flex-none tabular-nums", TIMER_TONE_CLASS[tone])}>
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
            <span className="s-ticket-qty text-[22px] leading-none tabular-nums flex-none min-w-[2.1ch]">
              {item.quantity}&times;
            </span>
            <span className="text-[17px] font-extrabold text-ink leading-snug">{item.name}</span>
          </li>
        ))}
      </ul>

      {alreadyMade.length > 0 && (
        // Demoted on purpose: these are not the kitchen's work, and mixing them
        // in with the cooking lines is how the wrong thing gets made.
        <p className="text-[12.5px] text-ink-soft border-t-2 border-dashed border-line pt-2">
          Tanpa racik, kasir yang siapkan:{" "}
          {alreadyMade.map((item) => `${item.quantity}× ${item.name}`).join(", ")}
        </p>
      )}

      {ticket.notes && (
        <p className="s-ticket-note">
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
