import type { OrderChannel, OrderStatus, PaymentMethod, PaymentStatus } from "@/types/order";

/** One line of an order, priced as it was when the order was placed. */
export interface TrackedOrderItem {
  name: string;
  quantity: number;
  /** The price snapshot taken at checkout — never the product's price today. */
  priceAtOrder: number;
  subtotal: number;
}

/**
 * An order flattened to plain values for the tracking and confirmation pages.
 *
 * Prisma rows carry Temporal instants, which cannot cross the server/client
 * boundary or survive JSON, so nothing here is a row.
 */
export interface TrackedOrder {
  orderNumber: string;
  customerName: string;
  pickupSlot: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  notes: string | null;
  totalAmount: number;
  /** True when any item still has to be made to order. */
  needsPrep: boolean;
  items: TrackedOrderItem[];
}

/** What the till needs to show once an on-the-spot sale has been saved. */
export interface OnsiteOrderReceipt {
  orderNumber: string;
  /** IN_QUEUE when something goes to the kitchen, DONE when it can be handed over now. */
  status: Extract<OrderStatus, "IN_QUEUE" | "DONE">;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  cashReceived: number | null;
  /** Cash to hand back; null for QRIS. */
  change: number | null;
  /** Units of NEEDS_PREP items sent to the kitchen. */
  prepItemCount: number;
}

/** One line of a preorder as the cashier's verification screen shows it. */
export interface CashierPreorderItem {
  name: string;
  quantity: number;
  priceAtOrder: number;
  subtotal: number;
  /** Made to order, so this line is what sends the order to the kitchen. */
  needsPrep: boolean;
}

/**
 * A preorder flattened to plain values for the cashier's pickup screen.
 *
 * Same reason as `TrackedOrder`: Prisma rows carry Temporal instants, which do
 * not survive the server/client boundary. `id` is here because the cashier's
 * actions address the order by id, while the customer-facing screens only ever
 * know it by number.
 */
export interface CashierPreorder {
  id: string;
  orderNumber: string;
  customerName: string;
  pickupSlot: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** Transfer receipt the customer uploaded, for the cashier to check. */
  paymentProofUrl: string | null;
  status: OrderStatus;
  notes: string | null;
  totalAmount: number;
  /** Units ordered, across every line. */
  itemCount: number;
  /** True when any line still has to be made to order. */
  needsPrep: boolean;
  items: CashierPreorderItem[];
}

/** One line on a kitchen ticket. */
export interface KitchenTicketItem {
  name: string;
  quantity: number;
  /** Made to order. The board shows these large and demotes the rest. */
  needsPrep: boolean;
}

/** The three statuses that put an order on the kitchen board. */
export type KitchenStatus = Extract<OrderStatus, "IN_QUEUE" | "IN_PROGRESS" | "READY">;

/**
 * An order as the kitchen board sees it.
 *
 * Timestamps are ISO 8601 strings, not Temporal instants: this view model is
 * serialised to JSON by `/api/kitchen` and polled from the browser, and an
 * instant survives neither the server/client boundary nor `JSON.stringify`.
 */
export interface KitchenTicket {
  id: string;
  orderNumber: string;
  channel: OrderChannel;
  customerName: string;
  status: KitchenStatus;
  notes: string | null;
  /**
   * When the order joined the queue. Every route onto the board passes through
   * IN_QUEUE, so in practice this is always set — but the column is nullable,
   * so `createdAt` is here as a floor the timer can always fall back on.
   */
  queuedAt: string | null;
  startedAt: string | null;
  createdAt: string;
  items: KitchenTicketItem[];
}

/** What `/api/kitchen` answers with. */
export interface KitchenQueueResponse {
  tickets: KitchenTicket[];
}

/** One line of an order as the admin's detail sheet lists it. */
export interface AdminOrderItem {
  name: string;
  quantity: number;
  /** The price snapshot taken at checkout, not the product's price today. */
  priceAtOrder: number;
  subtotal: number;
}

/**
 * When the order passed each stage, as ISO strings. A stage it never reached is
 * null — an on-the-spot sale of something ready to serve has no `queuedAt`.
 */
export interface AdminOrderTimeline {
  createdAt: string;
  queuedAt: string | null;
  startedAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
}

/**
 * An order flattened for the admin's order list and detail sheet.
 *
 * Same reason as `TrackedOrder` and `CashierPreorder`: Prisma rows carry
 * Temporal instants, which do not survive the server/client boundary.
 */
export interface AdminOrder {
  id: string;
  orderNumber: string;
  channel: OrderChannel;
  status: OrderStatus;
  customerName: string;
  customerPhone: string | null;
  pickupSlot: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  notes: string | null;
  totalAmount: number;
  /** Units ordered, across every line. */
  itemCount: number;
  /** The member of staff who last handled it, if any. */
  handledByName: string | null;
  items: AdminOrderItem[];
  timeline: AdminOrderTimeline;
  /**
   * Whether an admin may still cancel this order. Read from the transition
   * table on the server rather than from a list of statuses written out here,
   * so the button cannot offer an edge the service would refuse.
   */
  canCancel: boolean;
}
