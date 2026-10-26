import { Temporal } from "@js-temporal/polyfill";
import {
  chargeRequestV1Schema,
  fail,
  invalidRequest,
  isAuthorized,
  ok,
  toChargeV1,
} from "@/lib/photobooth-api";
import { recordPhotoboothCharge } from "@/lib/services/external-charge.service";

/**
 * POST /api/internal/v1/photobooth-charges — a paid photobooth charge for a
 * preorder's note (BPB-098). Sending the same externalId again with the same
 * content answers 200 with the stored charge and adds nothing. Contract:
 * photobooth repo, docs/adr/003-main-app-contract.md, section 6.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return fail(401, "unauthorized");
  }

  const json: unknown = await request.json().catch(() => undefined);
  const parsed = chargeRequestV1Schema.safeParse(json);
  if (!parsed.success) return invalidRequest(parsed.error);

  try {
    const outcome = await recordPhotoboothCharge({
      ...parsed.data,
      paidAt: Temporal.Instant.from(parsed.data.paidAt),
    });
    switch (outcome.kind) {
      case "created":
        return ok(toChargeV1(outcome.charge), 201);
      case "existing":
        return ok(toChargeV1(outcome.charge));
      case "conflict":
        return fail(409, "conflict");
      case "not_found":
        return fail(404, "not_found");
    }
  } catch (error) {
    console.error("[photobooth-api] recording a charge failed", { error });
    return fail(500, "internal");
  }
}
