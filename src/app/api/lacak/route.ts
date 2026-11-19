import { findActiveCharges } from "@/lib/queries/external-charge.query";
import { normaliseOrderNumber } from "@/lib/order-number";
import { clientIp } from "@/lib/client-ip";
import { LIMITS, checkRateLimit, hitRateLimit } from "@/lib/services/rate-limit.service";
import { findForTracking, toTrackedOrder } from "@/lib/queries/order.query";
import type { TrackedOrder } from "@/types/order-view";
import { photoboothLink } from "@/lib/photobooth-link";
import { getSettings } from "@/lib/services/setting.service";

export interface TrackingResponse {
  order: TrackedOrder | null;
  /**
   * The photobooth link, with the token that skips typing the digits again:
   * this caller has just proven them. Absent when there is no order.
   */
  photoLink?: string | null;
  /** The booth's QRIS, for an order paid by QRIS; it is public anyway. */
  qrisImageUrl?: string | null;
  /**
   * Set when this address or this order number has missed too often lately:
   * nothing was looked up, and the tracker says when to try again.
   */
  retryAfterSeconds?: number;
}

/**
 * The endpoint the tracking page polls.
 *
 * Always answers 200, with `order: null` for every kind of miss. A 404 for
 * "unknown number" and a 403 for "wrong digits" would let someone walk the
 * order numbers and learn which ones exist. (They are random now, but the
 * older sequential ones are still out there.)
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const orderNumber = normaliseOrderNumber(params.get("no") ?? "");
  const phoneLast4 = params.get("wa")?.trim() ?? "";

  const empty: TrackingResponse = { order: null };
  const headers = { "Cache-Control": "no-store" };

  if (orderNumber === "" || phoneLast4 === "") {
    return Response.json(empty, { headers });
  }

  // The four digits are the only secret on an older, sequential order number:
  // 10,000 guesses would find them. So misses are counted, per address and per
  // number, and once either is over its limit nothing is looked up at all —
  // a right guess then looks exactly like a wrong one. Polling an order that
  // was found never counts.
  const ip = clientIp(request.headers);
  const [byIp, byNumber] = await Promise.all([
    checkRateLimit(LIMITS.trackMissPerIp, ip),
    checkRateLimit(LIMITS.trackMissPerOrder, orderNumber),
  ]);
  if (!byIp.allowed || !byNumber.allowed) {
    const retryAfterSeconds = Math.max(byIp.retryAfterSeconds, byNumber.retryAfterSeconds);
    return Response.json({ order: null, retryAfterSeconds } satisfies TrackingResponse, { headers });
  }

  const order = await findForTracking(orderNumber, phoneLast4);
  if (!order) {
    await Promise.all([
      hitRateLimit(LIMITS.trackMissPerIp, ip),
      hitRateLimit(LIMITS.trackMissPerOrder, orderNumber),
    ]);
  }
  const charges = order ? await findActiveCharges([order.id]) : null;
  const qrisImageUrl =
    order?.paymentMethod === "QRIS" ? ((await getSettings()).qrisImageUrl ?? null) : null;
  const body: TrackingResponse = order
    ? {
        order: toTrackedOrder(order, charges?.get(order.id)),
        photoLink: photoboothLink(order, { withToken: true }),
        qrisImageUrl,
      }
    : { order: null };

  return Response.json(body, { headers });
}
