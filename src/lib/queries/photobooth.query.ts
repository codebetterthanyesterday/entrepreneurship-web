import type { Temporal } from "@js-temporal/polyfill";
import { prisma as db } from "@/lib/prisma";
import type { FeedCursor } from "@/lib/photobooth-api";
import type { OrderWithItems } from "@/lib/services/order.service";

/**
 * Reads for the photobooth's internal API. Preorders only: an on-the-spot
 * order never leaves through here, whatever number is asked for.
 */

export async function findPreorderForPhotobooth(
  orderNumber: string,
): Promise<OrderWithItems | null> {
  return await db.orm.public.Order.where({ orderNumber, channel: "PREORDER" })
    .include("items", (item) => item.include("product"))
    .first();
}

export interface PreorderPage {
  orders: OrderWithItems[];
  /** Position of the last order returned, when more follow. */
  next: FeedCursor | null;
}

/**
 * Preorders changed at or after `updatedSince`, oldest change first, ordered
 * by (updatedAt, orderNumber) so that orders changed in the same instant still
 * have a fixed place, and a page boundary never skips or repeats one.
 *
 * Cancelled preorders are included on purpose: the photobooth needs to learn
 * that an order was cancelled.
 */
export async function listPreordersForPhotobooth(options: {
  updatedSince?: Temporal.Instant;
  after?: FeedCursor;
  limit: number;
}): Promise<PreorderPage> {
  let query = db.orm.public.Order.where({ channel: "PREORDER" });
  if (options.updatedSince) {
    const since = options.updatedSince;
    query = query.where((order) => order.updatedAt.gte(since));
  }

  let ordered = query
    .include("items", (item) => item.include("product"))
    .orderBy([(order) => order.updatedAt.asc(), (order) => order.orderNumber.asc()]);
  if (options.after) {
    ordered = ordered.cursor({
      updatedAt: options.after.updatedAt,
      orderNumber: options.after.orderNumber,
    });
  }

  // One extra row says whether another page exists, without a count query.
  const rows = await ordered.limit(options.limit + 1).all();
  const orders = rows.slice(0, options.limit);
  const last = orders[orders.length - 1];

  return {
    orders,
    next:
      rows.length > options.limit && last
        ? { updatedAt: last.updatedAt, orderNumber: last.orderNumber }
        : null,
  };
}
