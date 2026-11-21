import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ user: null as { id: string; name: string; role: string } | null }));
vi.mock("@/lib/session", async () => {
  const { ForbiddenError, UnauthorizedError } = await import("@/lib/errors");
  return {
    requireRole: async (...allowed: string[]) => {
      if (!session.user) throw new UnauthorizedError();
      if (!allowed.includes(session.user.role)) throw new ForbiddenError();
      return session.user;
    },
  };
});

const { DELETE, GET, POST } = await import("@/app/api/staff/push/route");
const { closeDatabase, db, makeUser, resetDatabase } = await import("@/lib/services/__tests__/helpers/test-db");

const SUB = { endpoint: "https://push.example/phone-1", keys: { p256dh: "p".repeat(40), auth: "a".repeat(16) } };
const json = (method: string, body: unknown) =>
  new Request("http://localhost/api/staff/push", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function signIn(role: "KASIR" | "ADMIN") {
  const user = await makeUser(role);
  session.user = { id: user.id, name: user.name, role };
  return user;
}

beforeEach(async () => {
  await resetDatabase();
  session.user = null;
  delete process.env.VAPID_PUBLIC_KEY;
});
afterAll(async () => {
  await closeDatabase();
});

describe("/api/staff/push", () => {
  it("turns away a request without a session", async () => {
    expect((await GET()).status).toBe(401);
    expect((await POST(json("POST", SUB))).status).toBe(401);
  });

  it("hands a phone the public key, or none while the server has no keys", async () => {
    await signIn("KASIR");
    expect(await (await GET()).json()).toEqual({ ok: true, data: { publicKey: null } });
    process.env.VAPID_PUBLIC_KEY = "BPublicKey";
    expect(await (await GET()).json()).toEqual({ ok: true, data: { publicKey: "BPublicKey" } });
  });

  it("keeps a phone's subscription for whoever is signed in on it, and lets only them remove it", async () => {
    const farel = await signIn("KASIR");
    expect((await POST(json("POST", SUB))).status).toBe(200);
    expect((await db.orm.public.PushSubscription.all()).map((s) => s.userId)).toEqual([farel.id]);

    // The same phone, now signed in as someone else, is theirs.
    const rani = await signIn("ADMIN");
    await POST(json("POST", SUB));
    expect((await db.orm.public.PushSubscription.all()).map((s) => s.userId)).toEqual([rani.id]);

    // Farel cannot remove what is no longer his.
    session.user = { id: farel.id, name: farel.name, role: "KASIR" };
    await DELETE(json("DELETE", { endpoint: SUB.endpoint }));
    expect(await db.orm.public.PushSubscription.all()).toHaveLength(1);

    session.user = { id: rani.id, name: rani.name, role: "ADMIN" };
    await DELETE(json("DELETE", { endpoint: SUB.endpoint }));
    expect(await db.orm.public.PushSubscription.all()).toEqual([]);
  });

  it("refuses something that is not a subscription", async () => {
    await signIn("KASIR");
    expect((await POST(json("POST", { endpoint: "not a url" }))).status).toBe(400);
  });
});
