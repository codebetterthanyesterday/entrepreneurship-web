import { fail, isAuthorized, ok, ORDER_NUMBER_PATTERN, toPreorderV1 } from "@/lib/photobooth-api";
import { findPreorderForPhotobooth } from "@/lib/queries/photobooth.query";

/**
 * GET /api/internal/v1/preorders/{orderNumber} — one preorder, for the
 * photobooth. Contract: photobooth repo, docs/adr/003-main-app-contract.md.
 *
 * Unlike the public tracking endpoint, a miss is a plain 404: this route is
 * closed to everyone without the shared secret, so there is no visitor to
 * keep from walking the order numbers.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ orderNumber: string }> },
): Promise<Response> {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return fail(401, "unauthorized");
  }

  const { orderNumber } = await context.params;
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
    return fail(400, "invalid_request", "orderNumber");
  }

  try {
    const order = await findPreorderForPhotobooth(orderNumber);
    return order ? ok(toPreorderV1(order)) : fail(404, "not_found");
  } catch (error) {
    console.error("[photobooth-api] preorder lookup failed", {
      orderNumber,
      error,
    });
    return fail(500, "internal");
  }
}
