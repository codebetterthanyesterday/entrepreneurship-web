import type { KitchenStatus, KitchenTicket } from "@/types/order-view";

/**
 * How long a ticket may sit before the board starts nagging. Both are minutes,
 * and both are here rather than inline so the kitchen can be retuned after a
 * dry run without hunting through the component.
 */
export const WARN_AFTER_MINUTES = 5;
export const LATE_AFTER_MINUTES = 10;

/** How often the displayed minute count is recomputed, independent of polling. */
export const TIMER_TICK_MS = 30_000;

export type TimerTone = "neutral" | "warn" | "late";

/**
 * Whole minutes a ticket has been waiting, counted from `queuedAt`.
 *
 * `queuedAt`, never `createdAt`: a preorder may have been placed hours before
 * the customer turned up, and the kitchen is not late for the hours it did not
 * know the order existed. `createdAt` is only the floor for the theoretical row
 * whose `queuedAt` is null.
 *
 * A clock skew that puts the timestamp in the future reads as 0 rather than as
 * a negative count.
 */
export function minutesWaiting(ticket: KitchenTicket, now: number): number {
  const since = Date.parse(ticket.queuedAt ?? ticket.createdAt);
  if (Number.isNaN(since)) return 0;

  return Math.max(0, Math.floor((now - since) / 60_000));
}

/**
 * How loudly to draw the wait.
 *
 * READY never escalates. The cooking is done and the ticket is only waiting for
 * someone to carry it to the counter — colouring it as kitchen lateness would
 * point the blame at the wrong station and train the cooks to ignore red.
 */
export function timerTone(minutes: number, status: KitchenStatus): TimerTone {
  if (status === "READY") return "neutral";
  if (minutes >= LATE_AFTER_MINUTES) return "late";
  if (minutes >= WARN_AFTER_MINUTES) return "warn";
  return "neutral";
}

/** "baru" under a minute, then "3 mnt". */
export function formatWaiting(minutes: number): string {
  return minutes < 1 ? "baru" : `${minutes} mnt`;
}
