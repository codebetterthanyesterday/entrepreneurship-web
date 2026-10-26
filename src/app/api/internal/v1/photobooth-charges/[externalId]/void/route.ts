import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import {
  fail,
  invalidRequest,
  isAuthorized,
  ok,
  toChargeV1,
  voidRequestV1Schema,
} from "@/lib/photobooth-api";
import { voidPhotoboothCharge } from "@/lib/services/external-charge.service";

/**
 * POST /api/internal/v1/photobooth-charges/{externalId}/void — the crew took
 * back a payment at the photobooth (BPB-095), so its charge is voided. The
 * charge stays on record. Voiding again answers 200, so a retry never sticks.
 * Contract: photobooth repo, docs/adr/003-main-app-contract.md, section 6.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ externalId: string }> },
): Promise<Response> {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return fail(401, "unauthorized");
  }

  const { externalId } = await params;
  if (!z.uuid().safeParse(externalId).success) return fail(404, "not_found");

  const json: unknown = await request.json().catch(() => undefined);
  const parsed = voidRequestV1Schema.safeParse(json);
  if (!parsed.success) return invalidRequest(parsed.error);

  try {
    const charge = await voidPhotoboothCharge(
      externalId,
      Temporal.Instant.from(parsed.data.voidedAt),
    );
    return charge ? ok(toChargeV1(charge)) : fail(404, "not_found");
  } catch (error) {
    console.error("[photobooth-api] voiding a charge failed", { error });
    return fail(500, "internal");
  }
}
