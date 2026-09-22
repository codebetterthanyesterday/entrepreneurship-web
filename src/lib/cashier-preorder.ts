import { formatRupiah } from "@/lib/utils";
import type { OrderStatus } from "@/types/order";
import type { CashierPreorder } from "@/types/order-view";

// ---------------------------------------------------------------------------
// Status, as the counter reads it
// ---------------------------------------------------------------------------

export interface PreorderStatusStyle {
  label: string;
  /** Badge variant to draw it with. */
  variant: "info" | "prep" | "ok" | "muted" | "danger";
}

/**
 * The cashier sees plain language, not the technical status — the same rule the
 * customer's timeline follows, with the counter's vocabulary instead.
 */
export const PREORDER_STATUS: Readonly<Record<OrderStatus, PreorderStatusStyle>> = {
  CONFIRMED: { label: "Belum diambil", variant: "info" },
  IN_QUEUE: { label: "Di dapur", variant: "prep" },
  IN_PROGRESS: { label: "Lagi diracik", variant: "prep" },
  READY: { label: "Siap diserahkan", variant: "ok" },
  DONE: { label: "Selesai", variant: "muted" },
  CANCELLED: { label: "Dibatalkan", variant: "danger" },
};

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface PreorderFilter {
  key: string;
  label: string;
  /** Empty means "every status", including cancelled ones. */
  statuses: readonly OrderStatus[];
}

/**
 * The chips above the list. "Di dapur" folds IN_QUEUE and IN_PROGRESS together:
 * whether the kitchen has picked the order up yet makes no difference at the
 * counter, where the only thing that matters is that it cannot be handed over.
 */
export const PREORDER_FILTERS: readonly PreorderFilter[] = [
  { key: "all", label: "Semua", statuses: [] },
  { key: "waiting", label: "Belum diambil", statuses: ["CONFIRMED"] },
  { key: "kitchen", label: "Di dapur", statuses: ["IN_QUEUE", "IN_PROGRESS"] },
  { key: "ready", label: "Siap diserahkan", statuses: ["READY"] },
  { key: "done", label: "Selesai", statuses: ["DONE"] },
];

/** Case-insensitive match on the order number or the customer's name. */
export function matchesPreorderSearch(order: CashierPreorder, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (term === "") return true;

  return (
    order.orderNumber.toLowerCase().includes(term) ||
    order.customerName.toLowerCase().includes(term)
  );
}

// ---------------------------------------------------------------------------
// The one action
// ---------------------------------------------------------------------------

/**
 * What the detail sheet offers — exactly one thing, whatever the order's state.
 *
 *   - `PAY` opens the payment sheet and settles the bill.
 *   - `TRANSITION` moves the order along the chapter 3 transition table.
 *   - `BLOCKED` is a disabled button that says why there is nothing to do.
 */
export type PreorderAction =
  | { kind: "PAY"; label: string; variant: "primary" }
  | {
      kind: "TRANSITION";
      to: Extract<OrderStatus, "IN_QUEUE" | "DONE">;
      label: string;
      variant: "go" | "done";
    }
  | { kind: "BLOCKED"; label: string; variant: "flat" };

/** The fields the decision actually turns on. */
export type PreorderActionInput = Pick<
  CashierPreorder,
  "status" | "paymentStatus" | "totalAmount" | "needsPrep"
>;

/**
 * The single correct action for an order, from the chapter 3 transition table.
 *
 * A cashier at a busy counter should never have to pick between buttons that
 * could both be wrong, so this resolves to one and only one — and where there
 * is nothing legal to do, to a disabled button carrying the reason rather than
 * to a button that fails when pressed.
 *
 * The two terminal states are settled before payment is even considered.
 * `markAsPaid` refuses a cancelled order, so offering "Terima pembayaran" on
 * one would be a button that can only end in an error toast; and an order that
 * is already DONE has, by definition, been paid for and handed over.
 */
export function resolvePreorderAction(order: PreorderActionInput): PreorderAction {
  if (order.status === "CANCELLED") {
    return { kind: "BLOCKED", label: "Pesanan ini dibatalkan", variant: "flat" };
  }

  if (order.status === "DONE") {
    return { kind: "BLOCKED", label: "Pesanan ini sudah selesai", variant: "flat" };
  }

  // Nothing leaves the counter unpaid, whatever the kitchen has done with it.
  if (order.paymentStatus === "UNPAID") {
    return {
      kind: "PAY",
      label: `Terima pembayaran ${formatRupiah(order.totalAmount)}`,
      variant: "primary",
    };
  }

  if (order.status === "IN_QUEUE" || order.status === "IN_PROGRESS") {
    return { kind: "BLOCKED", label: "Tunggu dapur selesai dulu", variant: "flat" };
  }

  // CONFIRMED with something to make: the customer has turned up, so the
  // kitchen can start. Without anything to make, and from READY, it is handed
  // straight over.
  if (order.status === "CONFIRMED" && order.needsPrep) {
    return {
      kind: "TRANSITION",
      to: "IN_QUEUE",
      label: "Pelanggan datang, kirim ke dapur",
      variant: "go",
    };
  }

  return { kind: "TRANSITION", to: "DONE", label: "Serahkan sekarang", variant: "done" };
}
