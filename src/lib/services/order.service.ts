import { Temporal } from "@js-temporal/polyfill";
import {
  DEFAULT_CUTOFF_MINUTE,
  HANDOVER_LABEL,
  OTHER_DETAIL_MIN,
  isBookable,
  needsLocationReview,
  windowLabel,
  type HandoverLocation,
} from "@/lib/schedule";
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

/** A paket (combo) in the basket: which one, and how many of it. */
export interface BundleLineInput {
  bundleId: string;
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
  /** Pakets in the basket. Optional, so every caller written before bundles still works. */
  bundles?: readonly BundleLineInput[];
  customerName: string;
  customerPhone?: string | null;
  /** Legacy: a one-day slot by its label. New preorders use `schedule`. */
  pickupSlot?: string | null;
  /** A preorder's handover: where, any meeting-point note, and the time range booked. */
  schedule?: {
    location: HandoverLocation;
    detail?: string | null;
    serviceWindowId: string;
  } | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  cashReceived?: number | null;
  notes?: string | null;
  /** Set when the order is rung up by a cashier rather than by the customer. */
  handledById?: string | null;
}

/**
 * An order together with its items, each item's product, and the pakets on it.
 *
 * A paket's contents are ordinary `items` rows pointing at their `OrderBundle`
 * through `orderBundleId`, priced at zero; the money is on the bundle row. So
 * anything that only cares what has to be made or taken out of stock (the
 * kitchen, cancellation) can keep reading `items`, and anything that shows
 * money (receipts) reads loose items and `bundles` — see `order-lines.ts`.
 */
export type OrderWithItems = Shape<
  Models.public_Order,
  { "+": "bundles"; items: { "+": "product" } }
>;

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

/** Collapses repeated lines for the same paket into one, like `mergeOrderLines`. */
export function mergeBundleLines(bundles: readonly BundleLineInput[]): BundleLineInput[] {
  const merged = new Map<string, BundleLineInput>();

  for (const line of bundles) {
    const existing = merged.get(line.bundleId);
    if (existing) existing.quantity += line.quantity;
    else merged.set(line.bundleId, { bundleId: line.bundleId, quantity: line.quantity });
  }

  return [...merged.values()];
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
    .include("bundles")
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
  const requestedBundles = input.bundles ?? [];

  if (input.items.length === 0 && requestedBundles.length === 0) {
    throw new ValidationError("Pesanannya masih kosong, pilih menu dulu ya", "items");
  }

  if (input.items.some((item) => item.quantity <= 0)) {
    throw new ValidationError("Jumlah pesanan tiap menu minimal 1", "items");
  }

  if (requestedBundles.some((line) => line.quantity <= 0)) {
    throw new ValidationError("Jumlah tiap paket minimal 1", "items");
  }

  const items = mergeOrderLines(input.items);
  const bundleLines = mergeBundleLines(requestedBundles);

  return await db.transaction(async (tx) => {
    // (a0) Load every referenced paket with its contents. A paket is sold only
    // while it is switched on and holds at least one product.
    const bundleIds = bundleLines.map((line) => line.bundleId);
    const bundles =
      bundleIds.length === 0
        ? []
        : await tx.orm.public.Bundle.where((bundle) => bundle.id.in(bundleIds))
            .include("items")
            .all();
    const bundleById = new Map(bundles.map((bundle) => [bundle.id, bundle]));

    for (const bundleId of bundleIds) {
      const bundle = bundleById.get(bundleId);
      if (!bundle) throw new NotFoundError("Ada paket yang udah nggak ada di katalog");
      if (!bundle.isActive || bundle.items.length === 0) {
        throw new ValidationError(`Paket ${bundle.name} lagi nggak dijual`, "items");
      }
    }

    // (a) Load every referenced product — loose ones and every paket's
    // contents — and make sure each can still be sold.
    const productIds = [
      ...new Set([
        ...items.map((item) => item.productId),
        ...bundles.flatMap((bundle) => bundle.items.map((item) => item.productId)),
      ]),
    ];
    const products = await tx.orm.public.Product.where((product) => product.id.in(productIds)).all();
    const productById = new Map(products.map((product) => [product.id, product]));

    for (const item of items) {
      const product = productById.get(item.productId);
      if (!product) throw new NotFoundError("Ada menu yang udah nggak ada di katalog");
      if (!product.isActive) {
        throw new ValidationError(`Menu ${product.name} lagi nggak dijual`, "items");
      }
    }

    // A paket whose product was hidden is not on the menu either, whatever the
    // paket's own switch says.
    for (const bundle of bundles) {
      for (const component of bundle.items) {
        const product = productById.get(component.productId);
        if (!product?.isActive) {
          throw new ValidationError(`Paket ${bundle.name} lagi nggak dijual`, "items");
        }
      }
    }

    // (b) The channel this order came through has to be open. A missing
    // settings row fails closed: absent configuration must not read as "open".
    const settings = await tx.orm.public.StoreSetting.where({ id: 1 }).first();

    if (input.channel === "PREORDER" && settings?.preorderOpen !== true) {
      throw new ValidationError("Preorder lagi ditutup, beli langsung di booth ya");
    }

    // A customer can only be asked to pay by QRIS once there is a QRIS to show
    // them. At the booth the cashier has the printed one, so on-site is not held
    // to this.
    if (input.channel === "PREORDER" && input.paymentMethod === "QRIS" && !settings?.qrisImageUrl) {
      throw new ValidationError("QRIS lagi belum tersedia. Pilih bayar tunai pas ambil ya", "paymentMethod");
    }
    if (input.channel === "ONSITE" && settings?.boothOpen !== true) {
      throw new ValidationError("Booth lagi tutup, belum bisa terima pesanan");
    }

    // (c) A preorder books a time range on an open date — or, for orders from
    // before the schedule, a one-day slot by its label.
    const booked =
      input.channel === "PREORDER" && input.schedule
        ? await bookServiceWindow(
            tx,
            input.schedule,
            settings?.orderCutoffMinute ?? DEFAULT_CUTOFF_MINUTE,
          )
        : null;
    if (!booked && input.channel === "PREORDER" && input.pickupSlot) {
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

    // A paket is charged at its own price — the saving is the point of it —
    // read from the row now, never from the browser.
    const pricedBundles = bundleLines.map((line) => {
      const bundle = bundleById.get(line.bundleId)!;
      return {
        bundle,
        quantity: line.quantity,
        priceAtOrder: bundle.price,
        subtotal: bundle.price * line.quantity,
      };
    });

    // Every product this basket takes out of stock, loose and inside pakets,
    // for the status decision below.
    const allProductLines: OrderLineInput[] = [
      ...items,
      ...pricedBundles.flatMap(({ bundle, quantity }) =>
        bundle.items.map((component) => ({
          productId: component.productId,
          quantity: component.quantity * quantity,
        })),
      ),
    ];

    const totalAmount =
      lines.reduce((sum, line) => sum + line.subtotal, 0) +
      pricedBundles.reduce((sum, line) => sum + line.subtotal, 0);

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
      input.channel === "PREORDER" ? "CONFIRMED" : resolveInitialStatus(allProductLines, products);
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
      pickupSlot: booked?.label ?? input.pickupSlot ?? null,
      serviceDate: booked?.date ?? null,
      serviceWindowId: booked?.windowId ?? null,
      handoverLocation: booked ? input.schedule!.location : null,
      handoverDetail: booked ? input.schedule!.detail?.trim() || null : null,
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

    // (e2) Each paket: one priced row, then its contents as ordinary order
    // lines at zero, each taking its own product's stock. A shortfall in any
    // content throws InsufficientStockError naming that product and rolls the
    // whole order back, exactly as for a loose item.
    for (const line of pricedBundles) {
      const orderBundle = await tx.orm.public.OrderBundle.create({
        orderId: order.id,
        bundleId: line.bundle.id,
        name: line.bundle.name,
        quantity: line.quantity,
        priceAtOrder: line.priceAtOrder,
        subtotal: line.subtotal,
      });

      for (const component of line.bundle.items) {
        const quantity = component.quantity * line.quantity;

        await adjustStock({
          tx,
          productId: component.productId,
          delta: -quantity,
          reason: "ORDER_CONFIRMED",
          actorId: input.handledById ?? null,
          orderId: order.id,
        });

        await tx.orm.public.OrderItem.create({
          orderId: order.id,
          productId: component.productId,
          orderBundleId: orderBundle.id,
          quantity,
          priceAtOrder: 0,
          subtotal: 0,
        });
      }
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

/**
 * Books one place in a time range on a service date, for a preorder.
 *
 * Everything the checkout shows is checked again here, inside the order's
 * transaction: the date is open and serves the chosen place, it is still before
 * its cut-off, and "Lainnya" carries a location note. The quota is taken the
 * same way as the old slots, with `booked < quota` inside the UPDATE, so two
 * customers taking the last place at once cannot both get it.
 */
async function bookServiceWindow(
  tx: TxClient,
  schedule: { location: HandoverLocation; detail?: string | null; serviceWindowId: string },
  cutoffMinute: number,
): Promise<{ date: string; label: string; windowId: string }> {
  const window = await tx.orm.public.ServiceWindow.where({ id: schedule.serviceWindowId })
    .include("day")
    .first();
  const day = window?.day;

  if (!window || !day || !day.isOpen) {
    throw new ValidationError("Jadwal itu udah nggak tersedia, pilih tanggal lain ya", "serviceWindowId");
  }
  if (!day.locations.includes(schedule.location)) {
    throw new ValidationError(
      `Tanggal itu nggak melayani ${HANDOVER_LABEL[schedule.location]}, pilih tanggal lain ya`,
      "serviceWindowId",
    );
  }
  if (!isBookable(day.date, cutoffMinute)) {
    throw new ValidationError(
      "Pemesanan untuk tanggal itu udah ditutup. Pilih tanggal berikutnya ya",
      "serviceWindowId",
    );
  }
  if (schedule.location === "OTHER" && (schedule.detail?.trim().length ?? 0) < OTHER_DETAIL_MIN) {
    throw new ValidationError("Tulis lokasinya lengkap ya, biar kami bisa cek jangkauannya", "handoverDetail");
  }

  const label = windowLabel(window.startMinute, window.endMinute);
  const plan = db.raw
    .sql`UPDATE "public"."serviceWindow" SET "booked" = "booked" + 1 WHERE "id" = ${window.id} AND "booked" < "quota"`
    .affectedCount()
    .build();
  const { affectedRows } = await tx.execute(plan);

  if (affectedRows === 0) {
    throw new ValidationError(`Jam ${label} udah penuh, pilih jam lain ya`, "serviceWindowId");
  }

  return { date: day.date, label, windowId: window.id };
}

/** Gives a time range's place back when a preorder that held one is cancelled. */
async function releaseServiceWindow(tx: TxClient, windowId: string): Promise<void> {
  const plan = db.raw
    .sql`UPDATE "public"."serviceWindow" SET "booked" = "booked" - 1 WHERE "id" = ${windowId} AND "booked" > 0`
    .affectedCount()
    .build();

  await tx.execute(plan);
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

    // A "Lainnya" order is not made or handed over until staff have accepted
    // its location; cancelling it (rejecting) goes through `cancelOrder`.
    if (needsLocationReview(order)) {
      throw new ValidationError("Cek dan terima lokasi pesanan ini dulu sebelum diproses");
    }

    if (!(await applyStatus(tx, orderId, order.status, to))) {
      await throwForLostRace(tx, orderId, to, actor.role);
    }

    return await loadOrderWithItems(tx, orderId);
  });
}

/**
 * Staff accept a "Lainnya" order's location after checking it can be reached.
 * Conditional on still waiting, so accepting twice, or accepting an order that
 * was cancelled meanwhile, changes nothing. Rejecting is `cancelOrder` with the
 * reason in its note.
 */
export async function confirmHandoverLocation(orderId: string, actor: Actor): Promise<OrderWithItems> {
  return await db.transaction(async (tx) => {
    const order = await tx.orm.public.Order.where({ id: orderId }).first();
    if (!order) throw new NotFoundError("Pesanannya nggak ketemu");
    if (!needsLocationReview(order)) {
      throw new ValidationError("Pesanan ini nggak sedang menunggu cek lokasi");
    }

    const plan = tx.sql.public.order
      .update({ locationReviewedAt: Temporal.Now.instant(), handledById: actor.id })
      .where((field, fns) => fns.eq(field.id, orderId))
      .where((field, fns) => fns.eq(field.status, order.status))
      .build();
    const { affectedRows } = await tx.execute(plan);
    if (affectedRows === 0) {
      throw new ValidationError("Pesanan ini barusan berubah, muat ulang dulu ya");
    }

    return await loadOrderWithItems(tx, orderId);
  });
}

/**
 * Records that a "Lainnya" customer has been told how the check of their
 * location went. Only once the check is done, accepted or rejected; marking it
 * again keeps the first time, so two cashiers telling the same customer leave
 * one record of when it happened.
 */
export async function markLocationNotified(orderId: string): Promise<{ orderNumber: string }> {
  const order = await db.orm.public.Order.where({ id: orderId }).first();
  if (!order) throw new NotFoundError("Pesanannya nggak ketemu");
  if (order.handoverLocation !== "OTHER") {
    throw new ValidationError("Cuma pesanan berlokasi Lainnya yang perlu dikabari hasil cek lokasinya");
  }
  if (needsLocationReview(order)) {
    throw new ValidationError("Lokasinya belum dicek, terima atau tolak dulu ya");
  }

  if (!order.locationNotifiedAt) {
    await db.orm.public.Order.where({ id: orderId }).update({ locationNotifiedAt: Temporal.Now.instant() });
  }
  return { orderNumber: order.orderNumber };
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
    if (order.channel === "PREORDER" && order.serviceWindowId) {
      await releaseServiceWindow(tx, order.serviceWindowId);
    } else if (order.channel === "PREORDER" && order.pickupSlot) {
      await releasePickupSlot(tx, order.pickupSlot);
    }

    return await loadOrderWithItems(tx, orderId);
  });
}
