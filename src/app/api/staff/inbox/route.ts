import { Temporal } from "@js-temporal/polyfill";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { buildInbox, type InboxItem } from "@/lib/inbox";
import { loadInboxSnapshot } from "@/lib/queries/inbox.query";
import { requireRole } from "@/lib/session";
import type { UserRole } from "@/types/order";

export interface InboxResponse {
  items: InboxItem[];
}

/**
 * The staff inbox, for the signed-in person's role: what `/inbox` lists and
 * the header's bell counts. Polled, so never cached. The proxy's matcher
 * skips `/api/*`, so `requireRole` is what stands in front of it.
 */
export async function GET(): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };

  try {
    const user = await requireRole("KASIR", "DAPUR", "ADMIN");
    const snapshot = await loadInboxSnapshot();
    const body: InboxResponse = {
      items: buildInbox(snapshot, user.role as UserRole, Temporal.Now.instant()),
    };
    return Response.json(body, { headers });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: error.message }, { status: 401, headers });
    }
    if (error instanceof ForbiddenError) {
      return Response.json({ error: error.message }, { status: 403, headers });
    }
    console.error("[GET /api/staff/inbox]", error);
    return Response.json({ error: "Ada yang error nih, coba lagi ya" }, { status: 500, headers });
  }
}
