import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import {
  decodeCursor,
  encodeCursor,
  fail,
  isAuthorized,
  ok,
  toPreorderV1,
} from "@/lib/photobooth-api";
import { listPreordersForPhotobooth } from "@/lib/queries/photobooth.query";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

const querySchema = z.object({
  updatedSince: z.iso.datetime({ offset: true }).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

/**
 * GET /api/internal/v1/preorders?updatedSince=&cursor=&limit= — the change
 * feed the photobooth syncs from. Contract: photobooth repo,
 * docs/adr/003-main-app-contract.md.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return fail(401, "unauthorized");
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return fail(400, "invalid_request", typeof field === "string" ? field : undefined);
  }

  const after = parsed.data.cursor ? decodeCursor(parsed.data.cursor) : undefined;
  if (after === null) return fail(400, "invalid_request", "cursor");

  try {
    const page = await listPreordersForPhotobooth({
      updatedSince: parsed.data.updatedSince
        ? Temporal.Instant.from(parsed.data.updatedSince)
        : undefined,
      after,
      limit: parsed.data.limit,
    });

    return ok({
      items: page.orders.map(toPreorderV1),
      nextCursor: page.next ? encodeCursor(page.next) : null,
    });
  } catch (error) {
    console.error("[photobooth-api] preorder feed failed", { error });
    return fail(500, "internal");
  }
}
