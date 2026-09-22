import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { findKitchenQueue, toKitchenTicket } from "@/lib/queries/order.query";
import { requireRole } from "@/lib/session";
import type { KitchenQueueResponse } from "@/types/order-view";

/**
 * The endpoint the kitchen board polls every five seconds.
 *
 * Unlike `/api/lacak`, this one is not public and does not fail quietly: the
 * board is behind a login, so an unauthenticated or wrong-role request is a
 * real error and is told so. The proxy's matcher skips `/api/*` entirely, so
 * `requireRole` here is the only thing standing in front of the queue — it runs
 * before anything is read.
 */
export async function GET(): Promise<Response> {
  // Every response carries it: a board showing a stale queue because something
  // in between decided to cache it is worse than a board that is briefly empty.
  const headers = { "Cache-Control": "no-store" };

  try {
    await requireRole("DAPUR", "ADMIN");

    const orders = await findKitchenQueue();
    const body: KitchenQueueResponse = { tickets: orders.map(toKitchenTicket) };

    return Response.json(body, { headers });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: error.message }, { status: 401, headers });
    }

    if (error instanceof ForbiddenError) {
      return Response.json({ error: error.message }, { status: 403, headers });
    }

    // Anything else is ours, not the caller's. The detail goes to the log.
    console.error("[GET /api/kitchen]", error);
    return Response.json(
      { error: "Ada yang error nih, coba lagi ya" },
      { status: 500, headers },
    );
  }
}
