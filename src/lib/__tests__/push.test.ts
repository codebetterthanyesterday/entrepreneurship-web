import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ calls: [] as { endpoint: string; payload: string }[], gone: new Set<string>() }));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async (sub: { endpoint: string }, payload: string) => {
      if (sent.gone.has(sub.endpoint)) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      sent.calls.push({ endpoint: sub.endpoint, payload });
    }),
  },
}));

const { notifyStaff, pushAudience, pushMessage } = await import("@/lib/push");
const { closeDatabase, db, makeUser, resetDatabase } = await import("@/lib/services/__tests__/helpers/test-db");

async function subscribe(role: "KASIR" | "DAPUR" | "ADMIN", endpoint: string, active = true) {
  const user = await makeUser(role);
  if (!active) await db.orm.public.User.where({ id: user.id }).update({ isActive: false });
  await db.orm.public.PushSubscription.create({ userId: user.id, endpoint, p256dh: "p".repeat(40), auth: "a".repeat(16) });
}

beforeEach(async () => {
  await resetDatabase();
  sent.calls = [];
  sent.gone.clear();
  process.env.VAPID_PUBLIC_KEY = "public-key";
  process.env.VAPID_PRIVATE_KEY = "private-key";
});
afterEach(() => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
});
afterAll(async () => {
  await closeDatabase();
});

describe("push to staff phones", () => {
  it("says what the inbox says, and opens where the inbox would", () => {
    expect(pushMessage({ kind: "qris-proof", orderNumber: "PO-7KX4QM", customerName: "Rani" })).toEqual({
      title: "Bukti QRIS masuk",
      body: "PO-7KX4QM · Rani · cocokkan dengan notifikasi QRIS, lalu tandai lunas",
      href: "/kasir/preorder?pesanan=PO-7KX4QM",
      tag: "qris-proof:PO-7KX4QM",
    });
    expect(pushAudience("ready")).toEqual(["KASIR", "ADMIN"]);
  });

  it("reaches the phones of active staff whose inbox would show it, and no one else", async () => {
    await subscribe("KASIR", "https://push.example/kasir");
    await subscribe("ADMIN", "https://push.example/admin");
    await subscribe("DAPUR", "https://push.example/dapur");
    await subscribe("KASIR", "https://push.example/retired", false);

    const result = await notifyStaff({ kind: "qris-proof", orderNumber: "PO-7KX4QM", customerName: "Rani" });

    expect(result).toEqual({ sent: 2, removed: 0 });
    expect(sent.calls.map((call) => call.endpoint).sort()).toEqual(["https://push.example/admin", "https://push.example/kasir"]);
    expect(JSON.parse(sent.calls[0]!.payload).title).toBe("Bukti QRIS masuk");
  });

  it("forgets a phone the push service no longer knows", async () => {
    await subscribe("KASIR", "https://push.example/old-phone");
    sent.gone.add("https://push.example/old-phone");

    const result = await notifyStaff({ kind: "ready", orderNumber: "PO-1", customerName: "Dimas" });

    expect(result).toEqual({ sent: 0, removed: 1 });
    expect(await db.orm.public.PushSubscription.all()).toEqual([]);
  });

  it("sends nothing while the server has no VAPID keys", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    await subscribe("KASIR", "https://push.example/kasir");
    expect(await notifyStaff({ kind: "ready", orderNumber: "PO-1", customerName: "Dimas" })).toEqual({ sent: 0, removed: 0 });
    expect(sent.calls).toEqual([]);
  });
});
