import { z } from "zod";
import { prisma as db } from "@/lib/prisma";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { vapidPublicKey } from "@/lib/push";
import { requireRole } from "@/lib/session";

const headers = { "Cache-Control": "no-store" };

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(8).max(100) }),
});
const endpointSchema = z.object({ endpoint: z.url().max(1000) });

/**
 * A staff phone's push subscription (inbox phase 3). GET answers whether push
 * is set up on the server, with the public key a phone subscribes with; POST
 * saves this phone's subscription for the signed-in person; DELETE removes it.
 * A person only ever touches their own.
 */
export async function GET(): Promise<Response> {
  return await guard(async () => {
    const publicKey = vapidPublicKey();
    return Response.json({ ok: true, data: { publicKey } }, { headers });
  });
}

export async function POST(request: Request): Promise<Response> {
  return await guard(async (user) => {
    const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ ok: false, error: "Langganannya nggak valid" }, { status: 400, headers });
    const { endpoint, keys } = parsed.data;
    const existing = await db.orm.public.PushSubscription.where({ endpoint }).first();
    if (existing) {
      // The same browser, perhaps now signed in as someone else: it is theirs now.
      await db.orm.public.PushSubscription.where({ endpoint }).update({ userId: user.id, p256dh: keys.p256dh, auth: keys.auth });
    } else {
      await db.orm.public.PushSubscription.create({ userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth });
    }
    return Response.json({ ok: true, data: null }, { headers });
  });
}

export async function DELETE(request: Request): Promise<Response> {
  return await guard(async (user) => {
    const parsed = endpointSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ ok: false, error: "Langganannya nggak valid" }, { status: 400, headers });
    await db.orm.public.PushSubscription.where({ endpoint: parsed.data.endpoint, userId: user.id }).deleteAll();
    return Response.json({ ok: true, data: null }, { headers });
  });
}

async function guard(act: (user: { id: string }) => Promise<Response>): Promise<Response> {
  try {
    const user = await requireRole("KASIR", "DAPUR", "ADMIN");
    return await act(user);
  } catch (error) {
    if (error instanceof UnauthorizedError) return Response.json({ ok: false, error: error.message }, { status: 401, headers });
    if (error instanceof ForbiddenError) return Response.json({ ok: false, error: error.message }, { status: 403, headers });
    console.error("[/api/staff/push]", error);
    return Response.json({ ok: false, error: "Ada yang error nih, coba lagi ya" }, { status: 500, headers });
  }
}
