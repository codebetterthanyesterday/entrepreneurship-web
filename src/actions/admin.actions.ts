"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/lib/action-result";
import { requireRole, toActor } from "@/lib/session";
import { cancelOrderSchema } from "@/lib/validations/order.schema";
import { cancelOrder } from "@/lib/services/order.service";

/**
 * Voids an order from the admin's order list.
 *
 * ADMIN only — the cashier cancels from their own screen, where they can see
 * the customer standing in front of them; this one reaches any order in the
 * event, including ones another member of staff is mid-way through.
 *
 * The browser sends an order id and, at most, a reason. Everything that decides
 * whether the cancellation is allowed belongs to `cancelOrder`: `assertTransition`
 * rules out a status that cannot be voided, and the guarded status update
 * inside its transaction settles which of two simultaneous cancellations
 * actually happens. Returning stock and freeing the pickup slot happen there
 * too, in the same transaction — so a cancellation either lands whole or not at
 * all.
 */
export async function cancelOrderAction(
  input: unknown,
): Promise<ActionResult<{ orderNumber: string }>> {
  try {
    const user = await requireRole("ADMIN");
    const data = cancelOrderSchema.parse(input);

    const order = await cancelOrder(data.orderId, toActor(user), data.reason ?? null);

    // Stock came back and a slot may have freed up, so every screen that reads
    // either of those is now out of date — including the two the admin is not
    // looking at.
    for (const path of ["/admin", "/admin/pesanan", "/admin/menu", "/kasir", "/kasir/preorder", "/dapur", "/"]) {
      revalidatePath(path);
    }

    return { ok: true, data: { orderNumber: order.orderNumber } };
  } catch (error) {
    return toActionError(error, "cancelOrderAction");
  }
}
