import { Temporal } from "@js-temporal/polyfill";
import type { Shape } from "@prisma/orm-postgres/family-contract/types";
import type { Models } from "../../../prisma/schema";
import { prisma as db } from "@/lib/prisma";
import { getSettings } from "@/lib/services/setting.service";
import type { OrderChannel, OrderStatus, PaymentStatus } from "@/types/order";

/**
 * Every figure in this file obeys two rules, and they are separate rules.
 *
 * 1. Money is counted only from orders whose `paymentStatus` is `PAID`. An
 *    unpaid preorder is a promise, not cash in the tin.
 * 2. `CANCELLED` orders are excluded from every figure — not just the money,
 *    but the order count and the portions sold too. A voided sale never
 *    happened, and its stock has already been handed back.
 *
 * Counts of orders and portions therefore include unpaid orders, while every
 * rupiah figure does not. That is deliberate: "how many people ordered" and
 * "how much money came in" are different questions, and a dashboard that
 * answered both with the same population would misreport one of them.
 *
 * Money always comes from the snapshot columns — `Order.totalAmount` and
 * `OrderItem.priceAtOrder` / `subtotal` — never from `Product.price`. Repricing
 * a product after the event would otherwise rewrite history and leave the
 * report disagreeing with the cash that is actually in the tin.
 */

/** Market Day runs on Jakarta time, wherever the server happens to be. */
const EVENT_TIME_ZONE = "Asia/Jakarta";

/** Start and end of today, as instants, in the event's timezone. */
function todayBounds(now: Temporal.Instant = Temporal.Now.instant()) {
  const startOfDay = now.toZonedDateTimeISO(EVENT_TIME_ZONE).startOfDay();

  return {
    from: startOfDay.toInstant().toString(),
    to: startOfDay.add({ days: 1 }).toInstant().toString(),
  };
}

/**
 * Money actually taken today: the sum of every paid order's total.
 *
 * Cancelled orders are excluded even if they were paid before being voided —
 * the cashier's header is a running till figure, and money handed back is not
 * money taken.
 */
export async function getTodayRevenue(
  now: Temporal.Instant = Temporal.Now.instant(),
): Promise<number> {
  const { from, to } = todayBounds(now);

  const plan = db.raw.sql`
    SELECT COALESCE(SUM("totalAmount"), 0)::int AS "total"
    FROM "public"."order"
    WHERE "paymentStatus" = 'PAID'
      AND "status" <> 'CANCELLED'
      AND "createdAt" >= ${from}::timestamptz
      AND "createdAt" < ${to}::timestamptz
  `
    .returnsRow({ total: "pg/int4@1" })
    .build();

  const rows = await db.runtime().query(plan);
  return rows[0]?.total ?? 0;
}

// ---------------------------------------------------------------------------
// 1. Headline summary
// ---------------------------------------------------------------------------

/** The four dashboard stat cards, plus the two numbers their subtexts need. */
export interface SalesSummary {
  /** Rupiah taken, from paid orders only. */
  totalRevenue: number;
  /** Orders placed, cancellations aside — paid or not. */
  orderCount: number;
  /** Units ordered across every line, cancellations aside. */
  portionCount: number;
  /** Stock still on the shelf, across active products. */
  remainingStock: number;
  /** Products currently on the menu — the denominator for "porsi terjual". */
  activeProductCount: number;
  /** `totalRevenue / orderCount`, rounded to whole rupiah; 0 with no orders. */
  averageOrderValue: number;
  /** Active products at or below the configured low-stock threshold. */
  lowStockCount: number;
}

/**
 * The headline figures, all read in one statement.
 *
 * One statement rather than five, because the dashboard refreshes while the
 * booth is still selling: five separate reads could straddle a sale and leave
 * the cards contradicting each other — revenue counting an order that the order
 * count did not. A single statement sees one snapshot.
 *
 * `averageOrderValue` divides the two figures the dashboard shows side by side,
 * so an admin checking the card against the numbers above it gets the same
 * answer. That does mean unpaid preorders pull the average down; that is the
 * honest reading of "money in, per order taken".
 */
export async function getSalesSummary(): Promise<SalesSummary> {
  // The threshold is admin-configurable, so it comes from the settings row
  // rather than being repeated here.
  const { lowStockThreshold } = await getSettings();

  const plan = db.raw.sql`
    SELECT
      (SELECT COALESCE(SUM("totalAmount"), 0)::int
         FROM "public"."order"
        WHERE "paymentStatus" = 'PAID'
          AND "status" <> 'CANCELLED')                       AS "totalRevenue",
      (SELECT COUNT(*)::int
         FROM "public"."order"
        WHERE "status" <> 'CANCELLED')                       AS "orderCount",
      (SELECT COALESCE(SUM(item."quantity"), 0)::int
         FROM "public"."orderItem" item
         JOIN "public"."order" ord ON ord."id" = item."orderId"
        WHERE ord."status" <> 'CANCELLED')                   AS "portionCount",
      (SELECT COALESCE(SUM("stock"), 0)::int
         FROM "public"."product"
        WHERE "isActive")                                    AS "remainingStock",
      (SELECT COUNT(*)::int
         FROM "public"."product"
        WHERE "isActive")                                    AS "activeProductCount",
      (SELECT COUNT(*)::int
         FROM "public"."product"
        WHERE "isActive"
          AND "stock" <= ${lowStockThreshold})               AS "lowStockCount"
  `
    .returnsRow({
      totalRevenue: "pg/int4@1",
      orderCount: "pg/int4@1",
      portionCount: "pg/int4@1",
      remainingStock: "pg/int4@1",
      activeProductCount: "pg/int4@1",
      lowStockCount: "pg/int4@1",
    })
    .build();

  const rows = await db.runtime().query(plan);
  const row = rows[0];

  const totalRevenue = row?.totalRevenue ?? 0;
  const orderCount = row?.orderCount ?? 0;

  return {
    totalRevenue,
    orderCount,
    portionCount: row?.portionCount ?? 0,
    remainingStock: row?.remainingStock ?? 0,
    activeProductCount: row?.activeProductCount ?? 0,
    averageOrderValue: orderCount === 0 ? 0 : Math.round(totalRevenue / orderCount),
    lowStockCount: row?.lowStockCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// 2. Preorder vs on-the-spot
// ---------------------------------------------------------------------------

/** What one sales channel brought in. */
export interface ChannelFigures {
  revenue: number;
  orderCount: number;
}

export interface ChannelBreakdown {
  preorder: ChannelFigures;
  onsite: ChannelFigures;
  /**
   * Preorder's share of revenue as a whole per cent, so that the dashboard's
   * two halves are `preorderPercentage` and `100 - preorderPercentage` exactly.
   * The interpretation sentence beside the bar gets quoted in the business
   * report, and it must not disagree with the legend above it by a rounding
   * point. 0 when nothing has been paid for yet.
   */
  preorderPercentage: number;
}

/**
 * Revenue and order count per channel.
 *
 * Revenue is paid-only and the order count is not, per the rules at the top of
 * this file — so a channel can legitimately show orders against zero revenue
 * when its preorders have not been collected yet.
 */
export async function getChannelBreakdown(): Promise<ChannelBreakdown> {
  const plan = db.raw.sql`
    SELECT
      "channel",
      COALESCE(SUM("totalAmount") FILTER (WHERE "paymentStatus" = 'PAID'), 0)::int AS "revenue",
      COUNT(*)::int AS "orderCount"
    FROM "public"."order"
    WHERE "status" <> 'CANCELLED'
    GROUP BY "channel"
  `
    .returnsRow({
      channel: "pg/text@1",
      revenue: "pg/int4@1",
      orderCount: "pg/int4@1",
    })
    .build();

  const rows = await db.runtime().query(plan);

  const empty = (): ChannelFigures => ({ revenue: 0, orderCount: 0 });
  const byChannel: Record<OrderChannel, ChannelFigures> = {
    PREORDER: empty(),
    ONSITE: empty(),
  };

  for (const row of rows) {
    const channel = row.channel as OrderChannel;
    // A channel the contract does not know about would be a schema change that
    // has not reached this file; ignoring it beats writing a stray key.
    if (channel in byChannel) {
      byChannel[channel] = { revenue: row.revenue, orderCount: row.orderCount };
    }
  }

  const preorder = byChannel.PREORDER;
  const onsite = byChannel.ONSITE;
  const totalRevenue = preorder.revenue + onsite.revenue;

  return {
    preorder,
    onsite,
    preorderPercentage:
      totalRevenue === 0 ? 0 : Math.round((preorder.revenue / totalRevenue) * 100),
  };
}

// ---------------------------------------------------------------------------
// 3. Best sellers
// ---------------------------------------------------------------------------

export interface TopProduct {
  productId: string;
  name: string;
  /** Units ordered, cancellations aside. */
  quantitySold: number;
  /** Rupiah from the paid share of those units, at the price charged. */
  revenue: number;
  /** For the ranking's thumbnail; null falls back to the product's initial. */
  imageUrl: string | null;
}

/**
 * The best-selling products, most portions first.
 *
 * Ranked on portions rather than rupiah — "lagi laris" is about what is walking
 * off the table, and a pricier menu should not outrank a cheaper one that sold
 * twice as many. Name is the final tiebreaker so that the ranking does not
 * reshuffle between the dashboard's 30-second refreshes when two menus are
 * level.
 *
 * Revenue sums `OrderItem.subtotal`, the amount actually charged for the line,
 * not `quantity * Product.price`.
 */
export async function getTopProducts(limit = 5): Promise<TopProduct[]> {
  const plan = db.raw.sql`
    SELECT
      product."id" AS "productId",
      product."name" AS "name",
      product."imageUrl" AS "imageUrl",
      COALESCE(SUM(item."quantity"), 0)::int AS "quantitySold",
      COALESCE(SUM(item."subtotal") FILTER (WHERE ord."paymentStatus" = 'PAID'), 0)::int AS "revenue"
    FROM "public"."orderItem" item
    JOIN "public"."order" ord ON ord."id" = item."orderId"
    JOIN "public"."product" product ON product."id" = item."productId"
    WHERE ord."status" <> 'CANCELLED'
    GROUP BY product."id", product."name", product."imageUrl"
    ORDER BY "quantitySold" DESC, "revenue" DESC, product."name" ASC
    LIMIT ${limit}
  `
    .returnsRow({
      productId: "pg/text@1",
      name: "pg/text@1",
      imageUrl: { codecId: "pg/text@1", nullable: true },
      quantitySold: "pg/int4@1",
      revenue: "pg/int4@1",
    })
    .build();

  const rows = await db.runtime().query(plan);

  return rows.map((row) => ({
    productId: row.productId,
    name: row.name,
    imageUrl: row.imageUrl,
    quantitySold: row.quantitySold,
    revenue: row.revenue,
  }));
}

// ---------------------------------------------------------------------------
// 4. Sales by hour
// ---------------------------------------------------------------------------

export interface HourlySales {
  /** Hour of the day, 0–23, in the event's timezone. */
  hour: number;
  revenue: number;
  orderCount: number;
}

/**
 * Revenue and orders grouped by the hour they came in, earliest first. Only
 * hours that saw a transaction appear.
 *
 * The hour is taken in Asia/Jakarta, not UTC. The server may well be running in
 * UTC, and bucketing there would shift every bar seven hours — an 11:00 rush
 * would be filed under 04:00 and the "when were we busiest" card would send the
 * report to the wrong conclusion.
 */
export async function getHourlySales(): Promise<HourlySales[]> {
  const plan = db.raw.sql`
    SELECT
      EXTRACT(HOUR FROM "createdAt" AT TIME ZONE ${EVENT_TIME_ZONE})::int AS "hour",
      COALESCE(SUM("totalAmount") FILTER (WHERE "paymentStatus" = 'PAID'), 0)::int AS "revenue",
      COUNT(*)::int AS "orderCount"
    FROM "public"."order"
    WHERE "status" <> 'CANCELLED'
    GROUP BY 1
    ORDER BY 1
  `
    .returnsRow({
      hour: "pg/int4@1",
      revenue: "pg/int4@1",
      orderCount: "pg/int4@1",
    })
    .build();

  const rows = await db.runtime().query(plan);

  return rows.map((row) => ({
    hour: row.hour,
    revenue: row.revenue,
    orderCount: row.orderCount,
  }));
}

// ---------------------------------------------------------------------------
// 5. Order pipeline
// ---------------------------------------------------------------------------

/** Every status an order can sit at while it is still a real order. */
export type PipelineStatus = Exclude<OrderStatus, "CANCELLED">;

/**
 * The pipeline in the order work actually flows through, so the dashboard can
 * render the stages left to right without deciding the order itself.
 */
export const PIPELINE_STATUSES = [
  "CONFIRMED",
  "IN_QUEUE",
  "IN_PROGRESS",
  "READY",
  "DONE",
] as const satisfies readonly PipelineStatus[];

export type OrderPipeline = Record<PipelineStatus, number>;

/**
 * How many orders sit at each stage. Stages with nothing in them read 0 rather
 * than going missing, so a stalled kitchen queue shows up as a tall bar next to
 * short ones instead of as a gap.
 */
export async function getOrderPipeline(): Promise<OrderPipeline> {
  const plan = db.raw.sql`
    SELECT "status", COUNT(*)::int AS "total"
    FROM "public"."order"
    WHERE "status" <> 'CANCELLED'
    GROUP BY "status"
  `
    .returnsRow({ status: "pg/text@1", total: "pg/int4@1" })
    .build();

  const rows = await db.runtime().query(plan);

  const pipeline = Object.fromEntries(
    PIPELINE_STATUSES.map((status) => [status, 0]),
  ) as OrderPipeline;

  for (const row of rows) {
    const status = row.status as PipelineStatus;
    if (status in pipeline) pipeline[status] = row.total;
  }

  return pipeline;
}

// ---------------------------------------------------------------------------
// 6. The full order list
// ---------------------------------------------------------------------------

/**
 * An order with its lines and, where a member of staff rang it up or handled
 * it, who that was.
 *
 * The handler is narrowed to id, name and role on purpose: the row is destined
 * for an admin screen, and the rest of the user row — the password hash above
 * all — has no business travelling there.
 */
export type OrderWithItemsAndHandler = Shape<
  Models.public_Order,
  { items: { "+": "product" }; handledBy: { "+": "id" | "name" | "role" } }
>;

export interface OrderListFilter {
  channel?: OrderChannel | null;
  /** One status, or several — the "unfinished" chip is a set of four. */
  status?: OrderStatus | readonly OrderStatus[] | null;
  paymentStatus?: PaymentStatus | null;
  /** 1-based. Out-of-range values are clamped rather than rejected. */
  page?: number;
  pageSize?: number;
}

export interface OrderListPage {
  orders: OrderWithItemsAndHandler[];
  /** Orders matching the filter, across every page. */
  total: number;
  /**
   * What the matching orders are worth, across every page.
   *
   * This is the face value of the listed orders, **not** takings, so the
   * paid-only rule at the top of this file deliberately does not apply: the
   * "Belum bayar" filter would otherwise report Rp0 and tell the admin nothing
   * about how much money is still out there to collect. Cancelled orders are
   * still left out, because a void is worth nothing — so on an unfiltered list
   * `total` can count an order that `totalAmount` does not.
   */
  totalAmount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Every order, newest first, filtered and paginated.
 *
 * Unlike the aggregates above, this one does **not** drop cancelled orders.
 * They are excluded from the figures because a void is not a sale, but the list
 * is the admin's audit trail — a cancellation that disappeared from it would be
 * a cancellation nobody could look up afterwards. Callers that want them gone
 * pass a `status` filter.
 *
 * `id` is the final sort key so that orders created in the same instant keep a
 * fixed order; without it a row could appear on two pages or on neither.
 */
export async function getAllOrders(filter: OrderListFilter = {}): Promise<OrderListPage> {
  const pageSize = clamp(Math.trunc(filter.pageSize ?? DEFAULT_PAGE_SIZE), 1, MAX_PAGE_SIZE);

  const statuses: OrderStatus[] =
    filter.status == null
      ? []
      : typeof filter.status === "string"
        ? [filter.status]
        : [...filter.status];

  let query = db.orm.public.Order;

  if (filter.channel) query = query.where({ channel: filter.channel });
  if (filter.paymentStatus) query = query.where({ paymentStatus: filter.paymentStatus });
  if (statuses.length > 0) query = query.where((order) => order.status.in(statuses));

  const [{ total }, { amount }] = await Promise.all([
    query.aggregate((aggregate) => ({ total: aggregate.count() })),
    // A separate read because it is a different population: the count is every
    // row the admin can see, the value is only the ones that still stand.
    query
      .where((order) => order.status.neq("CANCELLED"))
      .aggregate((aggregate) => ({ amount: aggregate.sum("totalAmount") })),
  ]);

  // Clamped against the real total, so a stale "page 9" link after a filter
  // change lands on the last page with rows on it rather than on an empty one.
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = clamp(Math.trunc(filter.page ?? 1), 1, pageCount);

  const orders = await query
    .include("items", (item) => item.include("product"))
    .include("handledBy", (user) => user.select("id", "name", "role"))
    .orderBy([(order) => order.createdAt.desc(), (order) => order.id.desc()])
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  // `sum` over an empty set is SQL NULL, not zero.
  return { orders, total, totalAmount: amount ?? 0, page, pageSize, pageCount };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// 7. Export rows
// ---------------------------------------------------------------------------

/**
 * A timestamp as a spreadsheet will read it: "2026-09-20 13:45", in the event's
 * timezone.
 *
 * Jakarta rather than UTC for the same reason the hourly chart is — a report
 * whose timestamps are seven hours out describes an event that did not happen.
 * The format is deliberately big-endian: it sorts correctly even when a
 * spreadsheet decides to treat the column as text, and it cannot be read as
 * either day-first or month-first by mistake.
 */
function toSheetTime(instant: Temporal.Instant | null | undefined): string {
  if (!instant) return "";

  const local = instant.toZonedDateTimeISO(EVENT_TIME_ZONE);
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${local.year}-${pad(local.month)}-${pad(local.day)} ` +
    `${pad(local.hour)}:${pad(local.minute)}`
  );
}

export interface OrderExportRow {
  orderNumber: string;
  channel: OrderChannel;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  pickupSlot: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  createdAt: string;
}

/**
 * One row per order, oldest first — the order the event actually happened in,
 * which is what a reader scrolling the sheet expects.
 *
 * Cancelled orders are included and carry `CANCELLED` in their status column.
 * Dropping them would leave the attachment unable to answer "what was voided,
 * and when"; keeping them lets the reader filter the column instead. For the
 * same reason `paymentStatus` is a column: it is what makes the total column
 * summable into the dashboard's revenue figure rather than something else.
 */
export async function getOrdersForExport(): Promise<OrderExportRow[]> {
  const orders = await db.orm.public.Order.orderBy([
    (order) => order.createdAt.asc(),
    (order) => order.id.asc(),
  ]).all();

  return orders.map((order) => ({
    orderNumber: order.orderNumber,
    channel: order.channel,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone ?? "",
    pickupSlot: order.pickupSlot ?? "",
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount,
    createdAt: toSheetTime(order.createdAt),
  }));
}

export interface OrderItemExportRow {
  orderNumber: string;
  productName: string;
  quantity: number;
  priceAtOrder: number;
  subtotal: number;
}

/**
 * One row per order line, grouped by order and in a stable order within it.
 *
 * Prices come from the line's own snapshot, so re-exporting after the menu has
 * been repriced produces the same numbers as the first export did.
 */
export async function getOrderItemsForExport(): Promise<OrderItemExportRow[]> {
  const plan = db.raw.sql`
    SELECT
      ord."orderNumber" AS "orderNumber",
      product."name" AS "productName",
      item."quantity" AS "quantity",
      item."priceAtOrder" AS "priceAtOrder",
      item."subtotal" AS "subtotal"
    FROM "public"."orderItem" item
    JOIN "public"."order" ord ON ord."id" = item."orderId"
    JOIN "public"."product" product ON product."id" = item."productId"
    ORDER BY ord."createdAt" ASC, ord."id" ASC, product."name" ASC
  `
    .returnsRow({
      orderNumber: "pg/text@1",
      productName: "pg/text@1",
      quantity: "pg/int4@1",
      priceAtOrder: "pg/int4@1",
      subtotal: "pg/int4@1",
    })
    .build();

  const rows = await db.runtime().query(plan);

  return rows.map((row) => ({
    orderNumber: row.orderNumber,
    productName: row.productName,
    quantity: row.quantity,
    priceAtOrder: row.priceAtOrder,
    subtotal: row.subtotal,
  }));
}

export interface ProductExportRow {
  name: string;
  categoryName: string;
  prepType: string;
  price: number;
  quantitySold: number;
  stock: number;
  revenue: number;
}

/**
 * One row per product, best seller first.
 *
 * `quantitySold` and `revenue` are computed exactly as the dashboard's "Lagi
 * laris" card computes them — cancellations dropped, money counted only where
 * the order was paid, every rupiah taken from the line's price snapshot — so
 * the attachment and the screen cannot disagree. A product that never sold is
 * still listed, at zero: "what did not move" is as much a finding as what did.
 *
 * `LEFT JOIN` is what keeps those rows: an inner join would silently shorten
 * the recap to the products that happened to sell.
 */
export async function getProductRecapForExport(): Promise<ProductExportRow[]> {
  const plan = db.raw.sql`
    SELECT
      product."name" AS "name",
      COALESCE(category."name", '') AS "categoryName",
      product."prepType" AS "prepType",
      product."price" AS "price",
      product."stock" AS "stock",
      COALESCE(SUM(item."quantity") FILTER (WHERE ord."status" <> 'CANCELLED'), 0)::int
        AS "quantitySold",
      COALESCE(
        SUM(item."subtotal") FILTER (
          WHERE ord."status" <> 'CANCELLED' AND ord."paymentStatus" = 'PAID'
        ), 0
      )::int AS "revenue"
    FROM "public"."product" product
    LEFT JOIN "public"."category" category ON category."id" = product."categoryId"
    LEFT JOIN "public"."orderItem" item ON item."productId" = product."id"
    LEFT JOIN "public"."order" ord ON ord."id" = item."orderId"
    GROUP BY product."id", product."name", category."name",
             product."prepType", product."price", product."stock"
    ORDER BY "quantitySold" DESC, product."name" ASC
  `
    .returnsRow({
      name: "pg/text@1",
      categoryName: "pg/text@1",
      prepType: "pg/text@1",
      price: "pg/int4@1",
      stock: "pg/int4@1",
      quantitySold: "pg/int4@1",
      revenue: "pg/int4@1",
    })
    .build();

  const rows = await db.runtime().query(plan);

  return rows.map((row) => ({
    name: row.name,
    categoryName: row.categoryName,
    prepType: row.prepType,
    price: row.price,
    stock: row.stock,
    quantitySold: row.quantitySold,
    revenue: row.revenue,
  }));
}
