"use server";

import { revalidatePath } from "next/cache";
import { InsufficientStockError } from "@/lib/errors";
import { toActionError, type ActionResult } from "@/lib/action-result";
import { requireRole } from "@/lib/session";
import {
  createOnsiteOrderSchema,
  createPreorderSchema,
} from "@/lib/validations/order.schema";
import { createOrder } from "@/lib/services/order.service";
import type { OnsiteOrderReceipt } from "@/types/order-view";

/**
 * The customer's preorder submission.
 *
 * This runs as an unauthenticated POST that anyone can craft by hand, so the
 * only thing it trusts from the browser is which products and how many of them.
 * Everything that decides what the order costs or whether it has been paid for
 * is set here, on the server:
 *
 *   - `channel` is always PREORDER — this endpoint has no other purpose.
 *   - `paymentStatus` is always UNPAID. It is never read from the input, so a
 *     crafted request cannot mark an order paid and collect it for free. Only a
 *     cashier moves it, through `markAsPaid`.
 *   - No price, subtotal or total crosses the wire. `createOrder` reads each
 *     product's current price from its row and recomputes every rupiah.
 *   - `handledById` stays null; nobody on staff has touched this order yet.
 *
 * Stock is not handled here either — `createOrder` owns the guarded decrement,
 * and this action only translates its failure into something a customer can
 * read.
 */
export async function submitPreorderAction(
  input: unknown,
): Promise<ActionResult<{ orderNumber: string }>> {
  try {
    const data = createPreorderSchema.parse(input);

    const order = await createOrder({
      channel: "PREORDER",
      paymentStatus: "UNPAID",
      items: data.items,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      pickupSlot: data.pickupSlot,
      paymentMethod: data.paymentMethod,
      notes: data.notes ?? null,
    });

    // The catalogue shows live stock, so it has to reflect what was just taken.
    revalidatePath("/");
    revalidatePath("/menu");
    revalidatePath("/checkout");

    return { ok: true, data: { orderNumber: order.orderNumber } };
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return {
        ok: false,
        error: `Yah, ${error.productName} keburu habis. Kurangi jumlahnya atau pilih menu lain ya.`,
        field: "items",
      };
    }

    return toActionError(error, "submitPreorderAction");
  }
}

/** The name an on-the-spot order carries when the cashier did not ask for one. */
const WALK_IN_NAME = "Pelanggan booth";

/**
 * The cashier's on-the-spot sale.
 *
 * The caller is signed-in staff, but the request is still a POST anyone holding
 * a session can shape by hand, so it gets the same treatment as the preorder:
 * the browser says which products, how many, how the customer is paying and how
 * much cash changed hands. Everything else is decided here.
 *
 *   - Only KASIR and ADMIN get past the first line.
 *   - `channel` is always ONSITE.
 *   - `paymentStatus` is always PAID — a booth sale is paid for on the spot,
 *     before the customer walks away with anything.
 *   - `handledById` is the signed-in user, never a field from the input.
 *   - Prices and the total are recomputed by `createOrder` from the product
 *     rows. The cash check compares against that server-side total inside the
 *     same transaction, so a short payment is refused before any stock moves.
 *   - For QRIS, whatever `cashReceived` arrived is dropped.
 */
export async function submitOnsiteOrderAction(
  input: unknown,
): Promise<ActionResult<OnsiteOrderReceipt>> {
  try {
    const user = await requireRole("KASIR", "ADMIN");

    const data = createOnsiteOrderSchema.parse(input);
    const cashReceived = data.paymentMethod === "CASH" ? (data.cashReceived ?? null) : null;

    const order = await createOrder({
      channel: "ONSITE",
      paymentStatus: "PAID",
      handledById: user.id,
      items: data.items,
      customerName: data.customerName || WALK_IN_NAME,
      paymentMethod: data.paymentMethod,
      cashReceived,
      notes: data.notes ?? null,
    });

    revalidatePath("/kasir");
    revalidatePath("/dapur");
    // The public catalogue shows live stock too.
    revalidatePath("/");
    revalidatePath("/menu");

    const prepItemCount = order.items
      .filter((item) => item.product.prepType === "NEEDS_PREP")
      .reduce((sum, item) => sum + item.quantity, 0);

    return {
      ok: true,
      data: {
        orderNumber: order.orderNumber,
        status: order.status === "IN_QUEUE" ? "IN_QUEUE" : "DONE",
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        cashReceived: order.cashReceived ?? null,
        change: cashReceived === null ? null : cashReceived - order.totalAmount,
        prepItemCount,
      },
    };
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return {
        ok: false,
        error: `${error.productName} udah nggak cukup stoknya. Kurangi jumlahnya dulu ya.`,
        field: "items",
      };
    }

    return toActionError(error, "submitOnsiteOrderAction");
  }
}
