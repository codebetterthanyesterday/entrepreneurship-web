import { prisma as db } from "@/lib/prisma";
import type { TxClient } from "@/lib/db-types";
import { newOrderNumber, type OrderNumberPrefix } from "@/lib/order-number";
import type { OrderChannel } from "@/types/order";

const PREFIX: Record<OrderChannel, OrderNumberPrefix> = {
  PREORDER: "PO",
  ONSITE: "OS",
};

/** Draws before giving up. Two misses in a row are already one in 10^17. */
const ATTEMPTS = 5;

/**
 * A new order number for a channel, e.g. "PO-7KX4QM" / "OS-B4N8TZ": random, so
 * one order's number says nothing about any other's (see `@/lib/order-number`).
 *
 * MUST be called from inside a transaction — the caller passes the `tx` it is
 * already running in, so the check for a clash runs on the same connection
 * that then writes the Order row.
 *
 * A draw that names an existing order is drawn again. Two transactions drawing
 * the same new number at the same moment are left to `Order.orderNumber`'s
 * UNIQUE constraint, which fails one of them rather than hand out a duplicate;
 * at these numbers it does not happen in practice.
 *
 * The per-channel sequences from `20260919T0758_add_order_number_sequences`
 * are no longer drawn from. They stay in the database, unused, so no
 * migration has to drop anything.
 */
export async function generateOrderNumber(
  tx: TxClient,
  channel: OrderChannel,
): Promise<string> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const candidate = newOrderNumber(PREFIX[channel]);
    const plan = db.raw
      .sql`SELECT count(*)::int AS "taken" FROM public."order" WHERE "orderNumber" = ${candidate}`
      .returnsRow({ taken: "pg/int4@1" })
      .build();
    const rows = await tx.query(plan);
    if ((rows[0]?.taken ?? 0) === 0) return candidate;
  }

  throw new Error(`Could not draw a free ${PREFIX[channel]} order number in ${ATTEMPTS} attempts`);
}
