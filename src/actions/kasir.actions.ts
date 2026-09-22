"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/lib/action-result";
import { requireRole, toActor } from "@/lib/session";
import { markAsPaidSchema, transitionStatusSchema } from "@/lib/validations/order.schema";
import { markAsPaid, transitionStatus } from "@/lib/services/order.service";
import type { OrderStatus } from "@/types/order";

/**
 * The preorder desk changes two things the kitchen screen also reads, so both
 * actions below refresh both paths.
 */
function revalidateCounterAndKitchen(): void {
  revalidatePath("/kasir/preorder");
  revalidatePath("/dapur");
}

/**
 * Settles a preorder's bill at the pickup counter.
 *
 * The browser says which order and how much cash changed hands; nothing else.
 * `paymentStatus` is not an input — the service sets it — and `handledById` is
 * taken from the session, so a crafted request cannot credit the payment to
 * somebody else. Whether the order may be marked paid at all (not cancelled,
 * not already paid) is the service's decision, inside its transaction.
 */
export async function markAsPaidAction(
  input: unknown,
): Promise<ActionResult<{ orderNumber: string }>> {
  try {
    const user = await requireRole("KASIR", "ADMIN");
    const data = markAsPaidSchema.parse(input);

    const order = await markAsPaid(data.orderId, toActor(user), data.cashReceived ?? null);

    revalidateCounterAndKitchen();

    return { ok: true, data: { orderNumber: order.orderNumber } };
  } catch (error) {
    return toActionError(error, "markAsPaidAction");
  }
}

/**
 * Moves a preorder along the status table when the cashier presses the one
 * action their screen offers.
 *
 * Deliberately thin: the target status arrives from the browser, and this
 * action does not second-guess it. `assertTransition` inside the service is the
 * single place that decides which edges exist and which roles may walk them, so
 * a request naming an illegal jump — READY straight from CONFIRMED, say — is
 * refused by the same table the screen's button was derived from, whether or
 * not a button for it ever existed.
 */
export async function transitionOrderAction(
  input: unknown,
): Promise<ActionResult<{ orderNumber: string; status: OrderStatus }>> {
  try {
    const user = await requireRole("KASIR", "ADMIN");
    const data = transitionStatusSchema.parse(input);

    const order = await transitionStatus(data.orderId, data.to, toActor(user));

    revalidateCounterAndKitchen();

    return { ok: true, data: { orderNumber: order.orderNumber, status: order.status } };
  } catch (error) {
    return toActionError(error, "transitionOrderAction");
  }
}
