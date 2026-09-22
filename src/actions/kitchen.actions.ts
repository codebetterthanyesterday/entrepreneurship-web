"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/lib/action-result";
import { requireRole, toActor } from "@/lib/session";
import { transitionStatusSchema } from "@/lib/validations/order.schema";
import { transitionStatus } from "@/lib/services/order.service";
import type { OrderStatus } from "@/types/order";

/**
 * Moves a ticket from the kitchen board.
 *
 * Deliberately thin, exactly like its counterpart at the counter: the target
 * status comes from the browser and this action does not second-guess it.
 * `assertTransition` inside the service owns which edges exist and which roles
 * may walk them, and restating any of that here would give the rules two homes
 * that could disagree. In particular the backward edges — the "Balikin"
 * buttons — are legal moves in that table, not special cases.
 *
 * The guarded update behind `transitionStatus` also means two tablets tapping
 * the same ticket at the same moment cannot both apply their move.
 */
export async function transitionFromKitchenAction(
  input: unknown,
): Promise<ActionResult<{ orderNumber: string; status: OrderStatus }>> {
  try {
    const user = await requireRole("DAPUR", "ADMIN");
    const data = transitionStatusSchema.parse(input);

    const order = await transitionStatus(data.orderId, data.to, toActor(user));

    // The board is the obvious one; the counter's preorder list shows the same
    // statuses and would otherwise sit stale until its own refresh came round.
    revalidatePath("/dapur");
    revalidatePath("/kasir/preorder");

    return { ok: true, data: { orderNumber: order.orderNumber, status: order.status } };
  } catch (error) {
    return toActionError(error, "transitionFromKitchenAction");
  }
}
