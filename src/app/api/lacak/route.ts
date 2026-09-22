import { findForTracking, toTrackedOrder } from "@/lib/queries/order.query";
import type { TrackedOrder } from "@/types/order-view";

export interface TrackingResponse {
  order: TrackedOrder | null;
}

/**
 * The endpoint the tracking page polls.
 *
 * Always answers 200, with `order: null` for every kind of miss. A 404 for
 * "unknown number" and a 403 for "wrong digits" would let someone walk the
 * order numbers — they run in sequence — and learn which ones exist.
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const orderNumber = params.get("no")?.trim() ?? "";
  const phoneLast4 = params.get("wa")?.trim() ?? "";

  const empty: TrackingResponse = { order: null };
  const headers = { "Cache-Control": "no-store" };

  if (orderNumber === "" || phoneLast4 === "") {
    return Response.json(empty, { headers });
  }

  const order = await findForTracking(orderNumber, phoneLast4);
  const body: TrackingResponse = { order: order ? toTrackedOrder(order) : null };

  return Response.json(body, { headers });
}
