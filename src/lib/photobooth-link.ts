import { createHmac } from "node:crypto";
import type { OrderChannel } from "@/types/order";

/**
 * The link to a preorder's photos in the photobooth service, shown as a QR
 * code. The photobooth checks it; the scheme is shared with it (photobooth
 * repo, docs/adr/003-main-app-contract.md, section 10). Change both or neither.
 */
const TOKEN_PREFIX = "bunnye-claim-v1|";

/** HMAC of the order number. Identical to the photobooth's `claimLinkToken`. */
export function claimLinkToken(orderNumber: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(TOKEN_PREFIX + orderNumber)
    .digest("base64url");
}

/**
 * The photobooth link for an order, or null when there should be none: an
 * on-the-spot order, or a deployment without PHOTOBOOTH_URL.
 *
 * `withToken` adds the signed token that opens the photos without typing the
 * WhatsApp digits. Only pass it where the visitor has already proven those
 * digits (the tracking page). The order confirmation page is reachable by
 * order number alone, and the numbers run in sequence, so a token there would
 * hand anyone's photos to whoever guesses a number.
 */
export function photoboothLink(
  order: { orderNumber: string; channel: OrderChannel },
  options: { withToken: boolean },
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const base = env.PHOTOBOOTH_URL;
  if (!base || order.channel !== "PREORDER") return null;

  const url = new URL("/foto", base);
  url.searchParams.set("kode", order.orderNumber);

  const secret = env.PHOTOBOOTH_CLAIM_LINK_SECRET;
  if (options.withToken && secret) {
    url.searchParams.set("t", claimLinkToken(order.orderNumber, secret));
  }
  return url.toString();
}
