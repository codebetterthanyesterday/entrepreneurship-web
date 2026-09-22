import { prisma as db } from "@/lib/prisma";
import type { TxClient } from "@/lib/db-types";
import type { OrderChannel } from "@/types/order";

/**
 * One PostgreSQL sequence per channel, created by
 * `migrations/app/20260919T0758_add_order_number_sequences`.
 */
const SEQUENCE: Record<OrderChannel, string> = {
  PREORDER: "order_seq_preorder",
  ONSITE: "order_seq_onsite",
};

const PREFIX: Record<OrderChannel, string> = {
  PREORDER: "PO",
  ONSITE: "OS",
};

const DIGITS = 4;

/**
 * Next order number for a channel, e.g. "PO-0001" / "OS-0042".
 *
 * MUST be called from inside a transaction — the caller passes the `tx` it is
 * already running in, so the number is drawn on the same connection that
 * writes the Order row.
 *
 * The number comes from `nextval()` on a dedicated sequence, never from
 * counting existing rows. Counting is not safe under concurrency: two orders
 * created at the same time read the same count and produce the same number.
 * A sequence is atomic even across parallel transactions, and it deliberately
 * does not roll back — a gap in the numbering is the correct trade for never
 * handing out a duplicate. `Order.orderNumber` is UNIQUE as the last line of
 * defence.
 */
export async function generateOrderNumber(
  tx: TxClient,
  channel: OrderChannel,
): Promise<string> {
  const sequence = `public.${SEQUENCE[channel]}`;

  const plan = db.raw
    .sql`SELECT nextval(${sequence}::regclass)::int AS "value"`
    .returnsRow({ value: "pg/int4@1" })
    .build();

  const rows = await tx.query(plan);
  const value = rows[0]?.value;

  if (value === undefined) {
    throw new Error(`Failed to draw an order number from sequence ${sequence}`);
  }

  return `${PREFIX[channel]}-${String(value).padStart(DIGITS, "0")}`;
}
