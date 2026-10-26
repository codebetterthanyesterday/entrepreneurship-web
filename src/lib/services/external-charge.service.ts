import { Temporal } from "@js-temporal/polyfill";
import { prisma as db } from "@/lib/prisma";

/**
 * Charges other services add to an order's note: the photobooth's prints
 * and HD photos (BPB-098, decisions K-05 and K-13). They arrive already
 * paid, since the photobooth crew took the money; this app only records and
 * shows them. `Order.totalAmount` and the food lines are never touched.
 *
 * The contract is ADR-003, section 6, in the photobooth repo. Both calls are
 * idempotent, because the photobooth's sender retries until it gets through
 * and any request may arrive more than once.
 */

export interface ChargeInput {
  /** The sender's id for it; for the photobooth, the print job's id. */
  externalId: string;
  orderNumber: string;
  description: string;
  /** Whole Rupiah. */
  amount: number;
  paidAt: Temporal.Instant;
}

export interface ChargeRecord {
  externalId: string;
  orderNumber: string;
  description: string;
  amount: number;
  paidAt: Temporal.Instant;
  voidedAt: Temporal.Instant | null;
}

export type RecordOutcome =
  | { kind: "created" | "existing"; charge: ChargeRecord }
  | { kind: "conflict" }
  | { kind: "not_found" };

/**
 * Records a paid photobooth charge on a preorder.
 *
 * - The same `externalId` with the same content again: the stored charge, no
 *   second row.
 * - The same `externalId` with different content: `conflict`.
 * - An order number that does not exist, or is not a preorder: `not_found`.
 *
 * A cancelled preorder still takes the charge: the photobooth was paid, and
 * the note must say so (ADR-003, section 6).
 *
 * Two copies of one request arriving at once take turns on a lock keyed by
 * the external id, so the second one finds the first one's row.
 */
export async function recordPhotoboothCharge(input: ChargeInput): Promise<RecordOutcome> {
  return await db.transaction(async (tx) => {
    await tx.execute(
      db.raw
        .sql`SELECT pg_advisory_xact_lock(hashtextextended(${`external_charge:${input.externalId}`}, 0))`
        .affectedCount()
        .build(),
    );

    const existing = await tx.orm.public.ExternalCharge.where({ externalId: input.externalId })
      .include("order")
      .first();
    if (existing) {
      const charge = toRecord(existing, existing.order.orderNumber);
      const same =
        existing.source === "PHOTOBOOTH" &&
        charge.orderNumber === input.orderNumber &&
        charge.description === input.description &&
        charge.amount === input.amount &&
        Temporal.Instant.compare(charge.paidAt, input.paidAt) === 0;
      return same ? { kind: "existing", charge } : { kind: "conflict" };
    }

    const order = await tx.orm.public.Order.where({ orderNumber: input.orderNumber }).first();
    if (!order || order.channel !== "PREORDER") return { kind: "not_found" };

    const created = await tx.orm.public.ExternalCharge.create({
      source: "PHOTOBOOTH",
      externalId: input.externalId,
      description: input.description,
      amount: input.amount,
      paidAt: input.paidAt,
      voidedAt: null,
      orderId: order.id,
    });
    return { kind: "created", charge: toRecord(created, order.orderNumber) };
  });
}

/**
 * Voids a photobooth charge, when the crew take back a payment. Kept, never
 * deleted, for the record. Voiding again changes nothing and is not an
 * error, so a retrying sender never gets stuck. Null when the id is unknown.
 */
export async function voidPhotoboothCharge(
  externalId: string,
  voidedAt: Temporal.Instant,
): Promise<ChargeRecord | null> {
  return await db.transaction(async (tx) => {
    // Only the first void stamps the time; a repeat leaves it as it was.
    await tx.execute(
      db.raw
        .sql`UPDATE "public"."externalCharge" SET "voidedAt" = ${voidedAt.toString()}::timestamptz WHERE "externalId" = ${externalId} AND "voidedAt" IS NULL`
        .affectedCount()
        .build(),
    );
    const charge = await tx.orm.public.ExternalCharge.where({ externalId })
      .include("order")
      .first();
    return charge ? toRecord(charge, charge.order.orderNumber) : null;
  });
}

function toRecord(
  charge: {
    externalId: string;
    description: string;
    amount: number;
    paidAt: Temporal.Instant;
    voidedAt: Temporal.Instant | null;
  },
  orderNumber: string,
): ChargeRecord {
  return {
    externalId: charge.externalId,
    orderNumber,
    description: charge.description,
    amount: charge.amount,
    paidAt: charge.paidAt,
    voidedAt: charge.voidedAt,
  };
}
