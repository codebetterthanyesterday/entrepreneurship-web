import { or } from "@prisma/orm-postgres/orm-client";
import { prisma as db } from "@/lib/prisma";
import type { OrderWithItems } from "@/lib/services/order.service";
import type { OrderStatus } from "@/types/order";
import type {
  CashierPreorder,
  KitchenStatus,
  KitchenTicket,
  TrackedOrder,
} from "@/types/order-view";

/** Last four digits of a phone number, ignoring spaces, dashes and a leading +. */
function lastFourDigits(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/**
 * The order behind a confirmation page, looked up by its number alone.
 *
 * Read-only. The confirmation page is reached straight after checkout, so the
 * number is the only thing the customer has; anything that needs to be private
 * belongs on the tracking page instead.
 */
export async function findByNumber(orderNumber: string): Promise<OrderWithItems | null> {
  return await db.orm.public.Order.where({ orderNumber })
    .include("items", (item) => item.include("product"))
    .first();
}

/**
 * The order behind the tracking page, gated on the last four digits of the
 * WhatsApp number the customer gave at checkout.
 *
 * Returns `null` for every kind of miss — unknown number, wrong digits, or an
 * order saved without a phone number. Telling those apart would turn the page
 * into an oracle: order numbers run in sequence, so "that number exists, the
 * digits are wrong" is enough to walk PO-0001 upward and learn who ordered.
 */
export async function findForTracking(
  orderNumber: string,
  phoneLast4: string,
): Promise<OrderWithItems | null> {
  const expected = lastFourDigits(phoneLast4);
  if (!expected) return null;

  const order = await db.orm.public.Order.where({ orderNumber })
    .include("items", (item) => item.include("product"))
    .first();

  if (!order) return null;

  const actual = lastFourDigits(order.customerPhone);
  if (!actual || actual !== expected) return null;

  return order;
}

/**
 * Flattens an order for the confirmation and tracking screens.
 *
 * Line prices come from `priceAtOrder`, the snapshot taken at checkout — never
 * from the product row, which may have been repriced since. What the customer
 * is shown has to match what they actually agreed to pay.
 */
export function toTrackedOrder(order: OrderWithItems): TrackedOrder {
  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    pickupSlot: order.pickupSlot,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
    notes: order.notes,
    totalAmount: order.totalAmount,
    needsPrep: order.items.some((item) => item.product.prepType === "NEEDS_PREP"),
    items: order.items.map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
      priceAtOrder: item.priceAtOrder,
      subtotal: item.subtotal,
    })),
  };
}

/**
 * How many preorders still need the cashier — anything not yet handed over or
 * cancelled. Drives the count on the "Preorder" tab.
 */
export async function countUnfinishedPreorders(): Promise<number> {
  const result = await db.orm.public.Order.where({ channel: "PREORDER" })
    .where((order) => order.status.neq("DONE"))
    .where((order) => order.status.neq("CANCELLED"))
    .aggregate((aggregate) => ({ total: aggregate.count() }));

  return result.total;
}

/**
 * `%` and `_` are wildcards to ILIKE, and a backslash escapes them. A cashier
 * typing "%" is searching for a per-cent sign, not asking for every row.
 */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

export interface PreorderSearch {
  /** Matched against the order number and the customer's name, case-insensitively. */
  search?: string | null;
  /** Statuses to keep. Empty or absent means every status. */
  status?: readonly OrderStatus[];
}

/**
 * Preorders as the cashier sees them at the pickup counter, newest last:
 * ordered by pickup slot so the queue reads in the order people are due to
 * arrive, then by the time the order came in within each slot.
 *
 * Both filters are optional. The screen loads the whole list and narrows it in
 * the browser — a Market Day's worth of preorders is small, and a round trip
 * per keystroke would not be the instant filtering the counter needs. The
 * parameters are here so the same definition of "a preorder for the cashier"
 * serves a filtered read too.
 */
export async function findPreordersForCashier(
  filter: PreorderSearch = {},
): Promise<OrderWithItems[]> {
  let query = db.orm.public.Order.where({ channel: "PREORDER" });

  const search = filter.search?.trim();

  if (search) {
    const pattern = likePattern(search);
    query = query.where((order) =>
      or(order.orderNumber.ilike(pattern), order.customerName.ilike(pattern)),
    );
  }

  const statuses = filter.status ?? [];

  if (statuses.length > 0) {
    query = query.where((order) => order.status.in([...statuses]));
  }

  return await query
    .include("items", (item) => item.include("product"))
    .orderBy([(order) => order.pickupSlot.asc(), (order) => order.createdAt.asc()])
    .all();
}

/**
 * Flattens a preorder for the cashier's pickup screen.
 *
 * As on the customer's side, line prices come from `priceAtOrder` — the
 * snapshot taken at checkout. The cashier collects what the customer agreed to
 * pay, not what the product costs today.
 */
export function toCashierPreorder(order: OrderWithItems): CashierPreorder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    pickupSlot: order.pickupSlot,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paymentProofUrl: order.paymentProofUrl,
    status: order.status,
    notes: order.notes,
    totalAmount: order.totalAmount,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    needsPrep: order.items.some((item) => item.product.prepType === "NEEDS_PREP"),
    items: order.items.map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
      priceAtOrder: item.priceAtOrder,
      subtotal: item.subtotal,
      needsPrep: item.product.prepType === "NEEDS_PREP",
    })),
  };
}

/** The three statuses an order passes through while the kitchen has it. */
const KITCHEN_STATUSES = ["IN_QUEUE", "IN_PROGRESS", "READY"] as const;

/**
 * Everything the kitchen currently has, longest wait first.
 *
 * Ordered by `queuedAt` — the moment the order joined the queue, not the moment
 * it was created. An on-the-spot sale is queued as it is rung up, while a
 * preorder may have been placed hours earlier and only reaches the kitchen when
 * the customer turns up; sorting on `createdAt` would push every preorder to
 * the top of the board and starve the booth queue behind it. `createdAt` is
 * only a tiebreaker for two orders queued in the same instant.
 */
export async function findKitchenQueue(): Promise<OrderWithItems[]> {
  return await db.orm.public.Order.where((order) => order.status.in([...KITCHEN_STATUSES]))
    .include("items", (item) => item.include("product"))
    .orderBy([(order) => order.queuedAt.asc(), (order) => order.createdAt.asc()])
    .all();
}

/**
 * Flattens an order into a kitchen ticket.
 *
 * Every Temporal instant becomes an ISO string here, at the edge: this is the
 * one view model in the project that is serialised to JSON and fetched by the
 * browser rather than passed as a server component prop.
 */
export function toKitchenTicket(order: OrderWithItems): KitchenTicket {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    channel: order.channel,
    customerName: order.customerName,
    // The query only ever returns the three kitchen statuses, so this narrowing
    // is describing the query's guarantee rather than trusting the row.
    status: order.status as KitchenStatus,
    notes: order.notes,
    queuedAt: order.queuedAt?.toString() ?? null,
    startedAt: order.startedAt?.toString() ?? null,
    createdAt: order.createdAt.toString(),
    items: order.items.map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
      needsPrep: item.product.prepType === "NEEDS_PREP",
    })),
  };
}
