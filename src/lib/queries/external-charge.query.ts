import { prisma as db } from "@/lib/prisma";
import type { ExtraChargeLine } from "@/types/order-view";

/**
 * The photobooth charges on each of these orders, as note lines (BPB-098):
 * paid ones only, voided ones left out, in the order they were paid. Every
 * order asked about has an entry, empty when it has none.
 */
export async function findActiveCharges(
  orderIds: readonly string[],
): Promise<Map<string, ExtraChargeLine[]>> {
  const byOrder = new Map<string, ExtraChargeLine[]>(orderIds.map((id) => [id, []]));
  if (orderIds.length === 0) return byOrder;

  const charges = await db.orm.public.ExternalCharge.where((charge) =>
    charge.orderId.in([...orderIds]),
  )
    .where((charge) => charge.voidedAt.isNull())
    .orderBy([(charge) => charge.paidAt.asc(), (charge) => charge.createdAt.asc()])
    .all();

  for (const charge of charges) {
    byOrder.get(charge.orderId)?.push({
      key: charge.externalId,
      description: charge.description,
      amount: charge.amount,
    });
  }
  return byOrder;
}

/** What the lines add up to. */
export function chargesTotal(lines: readonly ExtraChargeLine[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}
