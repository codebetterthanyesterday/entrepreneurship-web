import { z } from "zod";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { claimItem, releaseItem } from "@/lib/services/inbox-claim.service";
import { inboxFor } from "@/lib/services/inbox.service";
import { requireRole } from "@/lib/session";
import type { UserRole } from "@/types/order";

const bodySchema = z.object({ key: z.string().min(3).max(200) });
const headers = { "Cache-Control": "no-store" };

/**
 * "Saya yang tangani" (POST) and letting go (DELETE), for one inbox item.
 * Only an item in the person's own inbox, and never a "Pantau" one: those
 * are a state to keep an eye on, not a job one person takes.
 */
export async function POST(request: Request): Promise<Response> {
  return await handle(request, async (user, key) => {
    const item = (await inboxFor(user)).find((candidate) => candidate.key === key);
    if (!item || item.tone === "watch") throw new ValidationError("Item itu nggak ada di Inbox kamu");
    await claimItem(key, user.id);
  });
}

export async function DELETE(request: Request): Promise<Response> {
  return await handle(request, async (user, key) => {
    await releaseItem(key, user.id);
  });
}

async function handle(
  request: Request,
  act: (user: { id: string; role: UserRole }, key: string) => Promise<void>,
): Promise<Response> {
  try {
    const user = await requireRole("KASIR", "DAPUR", "ADMIN");
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ ok: false, error: "Itemnya nggak dikenali" }, { status: 400, headers });
    await act({ id: user.id, role: user.role as UserRole }, parsed.data.key);
    return Response.json({ ok: true, data: null }, { headers });
  } catch (error) {
    if (error instanceof UnauthorizedError) return Response.json({ ok: false, error: error.message }, { status: 401, headers });
    if (error instanceof ForbiddenError) return Response.json({ ok: false, error: error.message }, { status: 403, headers });
    if (error instanceof ValidationError) return Response.json({ ok: false, error: error.message }, { status: 409, headers });
    console.error("[/api/staff/inbox/claim]", error);
    return Response.json({ ok: false, error: "Ada yang error nih, coba lagi ya" }, { status: 500, headers });
  }
}
