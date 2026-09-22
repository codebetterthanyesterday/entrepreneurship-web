import { Temporal } from "@js-temporal/polyfill";
import type { Shape } from "@prisma/orm-postgres/family-contract/types";
import type { Models } from "../../../prisma/schema";
import { prisma as db } from "@/lib/prisma";
import type { TxClient } from "@/lib/db-types";
import { ForbiddenError, InvalidTransitionError, NotFoundError, ValidationError } from "@/lib/errors";
import type {
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductPrepType,
  UserRole,
} from "@/types/order";
import { adjustStock } from "./stock.service";
import { generateOrderNumber } from "./order-number.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderLineInput {
  productId: string;
  quantity: number;
}

/** The only product fields `resolveInitialStatus` needs. */
export interface PrepTypeOf {
  id: string;
  prepType: ProductPrepType;
}

/** Where a basket goes once it is actually being served. */
export type InitialOrderStatus = Extract<OrderStatus, "IN_QUEUE" | "DONE">;

export interface Actor {
  id: string;
  role: UserRole;
}

export interface CreateOrderInput {
  channel: OrderChannel;
  items: readonly OrderLineInput[];
  customerName: string;
  customerPhone?: string | null;
  pickupSlot?: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  cashReceived?: number | null;
  notes?: string | null;
  /** Set when the order is rung up by a cashier rather than by the customer. */
  handledById?: string | null;
}

/** An order together with its items and each item's product. */
export type OrderWithItems = Shape<Models.public_Order, { items: { "+": "product" } }>;

// ---------------------------------------------------------------------------
// 1. Initial status
// ---------------------------------------------------------------------------

/**
 * Pure: an order carrying at least one NEEDS_PREP item goes to the kitchen
 * queue, anything else is handed over immediately. No database access.
 *
 * This answers "where does this basket go once it is being served" — which is
 * the status an on-the-spot sale starts at, and the status a preorder moves to
 * when the cashier confirms the customer has arrived.
 */
export function resolveInitialStatus(
  items: readonly OrderLineInput[],
  products: readonly PrepTypeOf[],
): InitialOrderStatus {
  const prepTypeById = new Map<string, ProductPrepType>(
    products.map((product) => [product.id, product.prepType]),
  );

  const needsPrep = items.some((item) => prepTypeById.get(item.productId) === "NEEDS_PREP");

  return needsPrep ? "IN_QUEUE" : "DONE";
}

/**
 * Collapses repeated lines for the same product into one.
 *
 * A client that sends the same product twice would otherwise produce two
 * OrderItem rows for one product — the stock arithmetic still comes out right,
 * but the receipt and the kitchen screen both read as if two different things
 * were ordered. Merging here also means each product's guarded stock decrement
 * runs once rather than once per duplicated line.
 */
export function mergeOrderLines(items: readonly OrderLineInput[]): OrderLineInput[] {
  const merged = new Map<string, OrderLineInput>();

  for (const item of items) {
    const existing = merged.get(item.productId);

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      merged.set(item.productId, { productId: item.productId, quantity: item.quantity });
    }
  }

  return [...merged.values()];
}

// ---------------------------------------------------------------------------
// 2. Status transitions
// ---------------------------------------------------------------------------

/**
 * The transition table from the implementation guide, chapter 3, as data: one
 * entry per legal edge, listing the roles allowed to walk it. A constant map is
 * auditable at a glance in a way nested conditionals are not — and anything
 * absent from it is rejected, whether or not a button for it reached a screen.
 */
export const TRANSITIONS: Readonly<
  Record<OrderStatus, Readonly<Partial<Record<OrderStatus, readonly UserRole[]>>>>
> = {
  CONFIRMED: {
    IN_QUEUE: ["KASIR"],
    DONE: ["KASIR"],
    CANCELLED: ["ADMIN", "KASIR"],
  },
  IN_QUEUE: {
    IN_PROGRESS: ["DAPUR"],
    CANCELLED: ["ADMIN", "KASIR"],
  },
  IN_PROGRESS: {
    IN_QUEUE: ["DAPUR"],
    READY: ["DAPUR"],
  },
  READY: {
    IN_PROGRESS: ["DAPUR"],
    DONE: ["KASIR", "DAPUR"],
  },
  DONE: {},
  CANCELLED: {},
};

/**
 * Throws `InvalidTransitionError` when the edge does not exist at all, and
 * `ForbiddenError` when the edge exists but this role may not walk it.
 */
export function assertTransition(from: OrderStatus, to: OrderStatus, role: UserRole): void {
  const allowedRoles = TRANSITIONS[from][to];

  if (allowedRoles === undefined) {
    throw new InvalidTransitionError(from, to);
  }

  if (!allowedRoles.includes(role)) {
    throw new ForbiddenError(
      `Peran ${role} nggak boleh mengubah pesanan dari ${from} ke ${to}.`,
    );
  }
}

/**
 * Whether `role` may walk this edge — the same table `assertTransition` reads,
 * asked as a question instead of an assertion.
 *
 * This is for screens deciding whether to draw a button at all. A button that
 * can only ever fail is worse than no button, and deriving the answer from the
 * table means a screen cannot drift out of step with what the server enforces.
 */
export function canTransition(from: OrderStatus, to: OrderStatus, role: UserRole): boolean {
  return TRANSITIONS[from][to]?.includes(role) ?? false;
}

/**
 * Moves an order to `to`, but only from the status the caller's decision was
 * actually based on.
 *
 * The `status = from` test is part of the UPDATE, so the database is what
 * decides whether the move is still available. Reading the status, checking it
 * against the table, and then writing is not safe: two cashiers with the same
 * order open both read CONFIRMED, both pass `assertTransition`, and both write
 * — and if one of them was cancelling, the order ends up in the kitchen queue
 * with its stock already handed back and its pickup slot already released.
 *
 * Zero rows affected means somebody else moved the order first.
 */
async function applyStatus(
  tx: TxClient,
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
  extra: { handledById?: string; notes?: string | null } = {},
): Promise<boolean> {
  const timestampField = STATUS_TIMESTAMP[to];

  const plan = tx.sql.public.order
    .update({
      status: to,
      ...(timestampField ? { [timestampField]: Temporal.Now.instant() } : {}),
      ...extra,
    })
    .where((field, fns) => fns.eq(field.id, orderId))
    .where((field, fns) => fns.eq(field.status, from))
    .build();

  const { affectedRows } = await tx.execute(plan);

  return affectedRows > 0;
}

/**
 * Called when `applyStatus` found no row to move. The order is re-read and
 * judged again by the same transition table, so the caller gets an error about
 * where the order actually is now rather than where it was a moment ago.
 */
async function throwForLostRace(
  tx: TxClient,
  orderId: string,
  to: OrderStatus,
  role: UserRole,
): Promise<never> {
  const current = await tx.orm.public.Order.where({ id: orderId }).first();
  if (!current) throw new NotFoundError("Pesanannya nggak ketemu");

  assertTransition(current.status, to, role);

  // The table says the move is legal against the status that is there now, so
  // the order moved and moved back while this transaction was running. Refuse
  // anyway: this request was decided against a status that no longer holds.
  throw new InvalidTransitionError(current.status, to);
}

/** The timestamp column each status stamps when an order arrives at it. */
const STATUS_TIMESTAMP: Readonly<Partial<Record<OrderStatus, "queuedAt" | "startedAt" | "readyAt" | "completedAt">>> = {
  IN_QUEUE: "queuedAt",
  IN_PROGRESS: "startedAt",
  READY: "readyAt",
  DONE: "completedAt",
};

// ---------------------------------------------------------------------------
// 3. Create
// ---------------------------------------------------------------------------

async function loadOrderWithItems(tx: TxClient, orderId: string): Promise<OrderWithItems> {
  const order = await tx.orm.public.Order.where({ id: orderId })
    .include("items", (item) => item.include("product"))
    .first();

  if (!order) throw new NotFoundError("Pesanannya nggak ketemu");

  return order;
}

/**
 * The single path into the orders table, shared by the customer preorder form
 * and the cashier's on-the-spot screen. Everything below happens in one
 * transaction: if any step fails — most importantly a stock shortfall — nothing
 * at all is written.
 */
export async function createOrder(input: CreateOrderInput): Promise<OrderWithItems> {
  if (input.items.length === 0) {
    throw new ValidationError("Pesanannya masih kosong, pilih menu dulu ya", "items");
  }

  if (input.items.some((item) => item.quantity <= 0)) {
    throw new ValidationError("Jumlah pesanan tiap menu minimal 1", "items");
  }

  const items = mergeOrderLines(input.items);

  return await db.transaction(async (tx) => {
    // (a) Load every referenced product and make sure it can still be sold.
    const productIds = items.map((item) => item.productId);
    const products = await tx.orm.public.Product.where((product) => product.id.in(productIds)).all();
    const productById = new Map(products.map((product) => [product.id, product]));

    for (const productId of productIds) {
      const product = productById.get(productId);
      if (!product) throw new NotFoundError("Ada menu yang udah nggak ada di katalog");
      if (!product.isActive) {
        throw new ValidationError(`Menu ${product.name} lagi nggak dijual`, "items");
      }
    }

    // (b) The channel this order came through has to be open. A missing
    // settings row fails closed: absent configuration must not read as "open".
    const settings = await tx.orm.public.StoreSetting.where({ id: 1 }).first();

    if (input.channel === "PREORDER" && settings?.preorderOpen !== true) {
      throw new ValidationError("Preorder lagi ditutup, beli langsung di booth ya");
    }
    if (input.channel === "ONSITE" && settings?.boothOpen !== true) {
      throw new ValidationError("Booth lagi tutup, belum bisa terima pesanan");
    }

    // (c) A preorder that picked a pickup slot has to fit in that slot.
    if (input.channel === "PREORDER" && input.pickupSlot) {
      await bookPickupSlot(tx, input.pickupSlot);
    }

    // (d) Money is computed from the price the product carries right now.
    const lines = items.map((item) => {
      const product = productById.get(item.productId)!;
      return {
        productId: item.productId,
        quantity: item.quantity,
        priceAtOrder: product.price,
        subtotal: product.price * item.quantity,
      };
    });

    const totalAmount = lines.reduce((sum, line) => sum + line.subtotal, 0);

    // Cash handed over at the counter has to cover the total — the total worked
    // out just above from the product rows, not any figure the till sent. It is
    // checked here, inside the transaction, so a short payment aborts before a
    // single unit of stock moves.
    if (
      input.paymentMethod === "CASH" &&
      input.cashReceived !== undefined &&
      input.cashReceived !== null &&
      input.cashReceived < totalAmount
    ) {
      throw new ValidationError(
        `Uangnya kurang ${formatShortfall(totalAmount - input.cashReceived)}`,
        "cashReceived",
      );
    }

    // Chapter 3: a preorder lands on CONFIRMED and waits for the customer to
    // turn up — the cashier is the one who moves it on to IN_QUEUE or DONE.
    // Only an on-the-spot sale skips straight to its resolved status.
    const status: OrderStatus =
      input.channel === "PREORDER" ? "CONFIRMED" : resolveInitialStatus(items, products);
    const now = Temporal.Now.instant();

    // (f) A number drawn from the channel's sequence — never a row count.
    const orderNumber = await generateOrderNumber(tx, input.channel);

    // (g) The order row goes in before the stock moves, so every StockMovement
    // this order causes can point back at it. A shortfall in the next step
    // rolls this row back along with everything else.
    const order = await tx.orm.public.Order.create({
      orderNumber,
      channel: input.channel,
      status,
      customerName: input.customerName,
      customerPhone: input.customerPhone ?? null,
      pickupSlot: input.pickupSlot ?? null,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus,
      cashReceived: input.cashReceived ?? null,
      notes: input.notes ?? null,
      handledById: input.handledById ?? null,
      totalAmount,
      queuedAt: status === "IN_QUEUE" ? now : null,
      completedAt: status === "DONE" ? now : null,
    });

    // (e) Take the stock. adjustStock guards the decrement in the database, so
    // an oversell throws InsufficientStockError naming the product — and that
    // error is deliberately left to propagate and abort the transaction.
    for (const line of lines) {
      await adjustStock({
        tx,
        productId: line.productId,
        delta: -line.quantity,
        reason: "ORDER_CONFIRMED",
        actorId: input.handledById ?? null,
        orderId: order.id,
      });

      await tx.orm.public.OrderItem.create({
        orderId: order.id,
        productId: line.productId,
        quantity: line.quantity,
        priceAtOrder: line.priceAtOrder,
        subtotal: line.subtotal,
      });
    }

    // (h)
    return await loadOrderWithItems(tx, order.id);
  });
}

function formatShortfall(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

/**
 * Takes one place in a pickup slot.
 *
 * The `booked < quota` test lives inside the UPDATE, so the database is what
 * decides whether there is room. Counting existing orders and comparing the
 * count against the quota is not safe: two customers checking out at the same
 * moment both read a count that is still under the quota and both get in, and a
 * slot of 20 ends up holding 22. Zero rows affected means the slot filled up —
 * either it was already full, or another checkout won the race.
 */
async function bookPickupSlot(tx: TxClient, label: string): Promise<void> {
  const slot = await tx.orm.public.PickupSlot.where({ label }).first();

  if (!slot || !slot.isActive) {
    throw new ValidationError("Slot pengambilannya udah nggak tersedia", "pickupSlot");
  }

  const plan = db.raw
    .sql`UPDATE "public"."pickupSlot" SET "booked" = "booked" + 1 WHERE "id" = ${slot.id} AND "isActive" = true AND "booked" < "quota"`
    .affectedCount()
    .build();

  const { affectedRows } = await tx.execute(plan);

  if (affectedRows === 0) {
    throw new ValidationError(`Slot ${label} udah penuh, pilih jam lain ya`, "pickupSlot");
  }
}

/** Gives a place back when an order that held one is cancelled. */
async function releasePickupSlot(tx: TxClient, label: string): Promise<void> {
  const plan = db.raw
    .sql`UPDATE "public"."pickupSlot" SET "booked" = "booked" - 1 WHERE "label" = ${label} AND "booked" > 0`
    .affectedCount()
    .build();

  await tx.execute(plan);
}

// ---------------------------------------------------------------------------
// 4. Transition
// ---------------------------------------------------------------------------

export async function transitionStatus(
  orderId: string,
  to: OrderStatus,
  actor: Actor,
): Promise<OrderWithItems> {
  return await db.transaction(async (tx) => {
    const order = await tx.orm.public.Order.where({ id: orderId }).first();
    if (!order) throw new NotFoundError("Pesanannya nggak ketemu");

    assertTransition(order.status, to, actor.role);

    if (!(await applyStatus(tx, orderId, order.status, to))) {
      await throwForLostRace(tx, orderId, to, actor.role);
    }

    return await loadOrderWithItems(tx, orderId);
  });
}

// ---------------------------------------------------------------------------
// 5. Payment
// ---------------------------------------------------------------------------

export async function markAsPaid(
  orderId: string,
  actor: Actor,
  cashReceived?: number | null,
): Promise<OrderWithItems> {
  return await db.transaction(async (tx) => {
    const order = await tx.orm.public.Order.where({ id: orderId }).first();
    if (!order) throw new NotFoundError("Pesanannya nggak ketemu");

    if (order.status === "CANCELLED") {
      throw new ValidationError("Pesanan yang udah dibatalin nggak bisa ditandai lunas");
    }
    if (order.paymentStatus === "PAID") {
      throw new ValidationError("Pesanan ini udah lunas kok");
    }

    await tx.orm.public.Order.where({ id: orderId }).update({
      paymentStatus: "PAID",
      handledById: actor.id,
      ...(cashReceived === undefined || cashReceived === null ? {} : { cashReceived }),
    });

    return await loadOrderWithItems(tx, orderId);
  });
}

// ---------------------------------------------------------------------------
// 6. Cancel
// ---------------------------------------------------------------------------

export async function cancelOrder(
  orderId: string,
  actor: Actor,
  reason?: string | null,
): Promise<OrderWithItems> {
  return await db.transaction(async (tx) => {
    const order = await tx.orm.public.Order.where({ id: orderId }).include("items").first();
    if (!order) throw new NotFoundError("Pesanannya nggak ketemu");

    assertTransition(order.status, "CANCELLED", actor.role);

    const notes = reason
      ? [order.notes, `Dibatalin: ${reason}`].filter(Boolean).join(" · ")
      : order.notes;

    // The guarded write goes first, before a single unit moves. It is what
    // decides whether this is the cancellation that happens, so only one of two
    // simultaneous cancellations gets as far as handing stock back — otherwise
    // both would, and the product would end the day with more units than it
    // ever had.
    if (!(await applyStatus(tx, orderId, order.status, "CANCELLED", {
      handledById: actor.id,
      notes,
    }))) {
      await throwForLostRace(tx, orderId, "CANCELLED", actor.role);
    }

    // Everything this order took out of stock goes back in, each return leaving
    // its own ORDER_CANCELLED movement.
    for (const item of order.items) {
      await adjustStock({
        tx,
        productId: item.productId,
        delta: item.quantity,
        reason: "ORDER_CANCELLED",
        actorId: actor.id,
        orderId: order.id,
      });
    }

    // The place this order held in its pickup slot goes back on the shelf too,
    // otherwise cancellations would slowly starve the slot.
    if (order.channel === "PREORDER" && order.pickupSlot) {
      await releasePickupSlot(tx, order.pickupSlot);
    }

    return await loadOrderWithItems(tx, orderId);
  });
}
