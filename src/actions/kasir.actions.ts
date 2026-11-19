"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/lib/action-result";
import { requireRole, toActor } from "@/lib/session";
import { z } from "zod";
import {
  cancelOrderSchema,
  markAsPaidSchema,
  transitionStatusSchema,
  updateOrderDetailsSchema,
} from "@/lib/validations/order.schema";
import {
  cancelOrder,
  confirmHandoverLocation,
  markAsPaid,
  markLocationNotified,
  transitionStatus,
  updateOrderDetails,
} from "@/lib/services/order.service";
import { findOrderById } from "@/lib/queries/order.query";
import { ValidationError } from "@/lib/errors";
import { needsLocationReview } from "@/lib/schedule";
import { LOCATION_REJECTED_REASON } from "@/lib/customer-chat";
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

/** A "Lainnya" location checked and within reach: the order can go ahead. */
export async function confirmHandoverLocationAction(
  orderId: unknown,
): Promise<ActionResult<{ orderNumber: string }>> {
  try {
    const user = await requireRole("KASIR", "ADMIN");
    const id = z.string().min(1, "Pesanannya nggak ketemu").parse(orderId);
    const order = await confirmHandoverLocation(id, toActor(user));
    revalidateCounterAndKitchen();
    return { ok: true, data: { orderNumber: order.orderNumber } };
  } catch (error) {
    return toActionError(error, "confirmHandoverLocationAction");
  }
}

/**
 * A "Lainnya" location out of reach: the order is cancelled, stock and its
 * place in the time range go back, and the reason is kept on the order. The
 * till can only do this to an order still waiting on its location; cancelling
 * anything else stays with admins.
 */
export async function rejectHandoverLocationAction(
  input: unknown,
): Promise<ActionResult<{ orderNumber: string }>> {
  try {
    const user = await requireRole("KASIR", "ADMIN");
    const data = cancelOrderSchema.parse(input);
    const order = await findOrderById(data.orderId);
    if (!order || !needsLocationReview(order)) {
      throw new ValidationError("Pesanan ini nggak sedang menunggu cek lokasi");
    }
    const reason = `${LOCATION_REJECTED_REASON}${data.reason ? `: ${data.reason}` : ""}`;
    const cancelled = await cancelOrder(data.orderId, toActor(user), reason);
    revalidateCounterAndKitchen();
    revalidatePath("/");
    return { ok: true, data: { orderNumber: cancelled.orderNumber } };
  } catch (error) {
    return toActionError(error, "rejectHandoverLocationAction");
  }
}

/**
 * A "Lainnya" customer has been told how the check of their location went.
 * The till and the admin's order sheet both mark it, so both lists refresh.
 */
export async function markLocationNotifiedAction(
  orderId: unknown,
): Promise<ActionResult<{ orderNumber: string }>> {
  try {
    await requireRole("KASIR", "ADMIN");
    const id = z.string().min(1, "Pesanannya nggak ketemu").parse(orderId);
    const result = await markLocationNotified(id);
    revalidatePath("/kasir/preorder");
    revalidatePath("/admin/pesanan");
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error, "markLocationNotifiedAction");
  }
}

/**
 * Corrects an order's name, WhatsApp number or handover at the customer's
 * request, from the cashier's preorder sheet or the admin's order list. The
 * acting staff member comes from the session.
 */
export async function updateOrderDetailsAction(
  input: unknown,
): Promise<ActionResult<{ orderNumber: string }>> {
  try {
    const user = await requireRole("KASIR", "ADMIN");
    const data = updateOrderDetailsSchema.parse(input);

    const order = await updateOrderDetails(
      data.orderId,
      {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        schedule: data.schedule && {
          location: data.schedule.handoverLocation,
          detail: data.schedule.handoverDetail,
          serviceWindowId: data.schedule.serviceWindowId,
        },
      },
      toActor(user),
    );

    revalidateCounterAndKitchen();
    revalidatePath("/admin/pesanan");
    // The schedule's remaining places changed for the checkout too.
    revalidatePath("/checkout");

    return { ok: true, data: { orderNumber: order.orderNumber } };
  } catch (error) {
    return toActionError(error, "updateOrderDetailsAction");
  }
}
