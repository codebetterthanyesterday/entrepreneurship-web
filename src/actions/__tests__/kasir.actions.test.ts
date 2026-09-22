import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// revalidatePath needs a request scope that does not exist in a test process.
// The action's caching behaviour is not what these tests are about.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// There is no request, so no NextAuth session either. The signed-in user is
// whatever the test puts here; requireRole keeps its real role check.
const session = vi.hoisted(() => ({
  user: null as { id: string; name: string; role: string } | null,
}));

// The mock replaces the whole module, so anything the actions import from it
// has to be here — including `toActor`. The real module is not imported even
// for that, because it pulls in NextAuth, which reaches for `next/server` and
// does not resolve outside a request.
vi.mock("@/lib/session", async () => {
  const { ForbiddenError, UnauthorizedError } = await import("@/lib/errors");
  return {
    toActor: (user: { id: string; role: string }) => ({ id: user.id, role: user.role }),
    requireRole: async (...allowed: string[]) => {
      if (!session.user) throw new UnauthorizedError();
      if (!allowed.includes(session.user.role)) throw new ForbiddenError();
      return session.user;
    },
  };
});

const { markAsPaidAction, transitionOrderAction } = await import("@/actions/kasir.actions");
const { createOrder, transitionStatus } = await import("@/lib/services/order.service");
const { findPreordersForCashier, toCashierPreorder } = await import("@/lib/queries/order.query");
const { resolvePreorderAction } = await import("@/lib/cashier-preorder");
type CashierPreorder = import("@/types/order-view").CashierPreorder;
const {
  closeDatabase,
  db,
  makePickupSlot,
  makeProduct,
  makeUser,
  resetDatabase,
} = await import("@/lib/services/__tests__/helpers/test-db");

const SLOT = "09.00 - 10.00";

async function signIn(role: "KASIR" | "ADMIN" | "DAPUR") {
  const user = await makeUser(role);
  session.user = { id: user.id, name: user.name, role };
  return user;
}

/** An unpaid preorder, with something to make unless told otherwise. */
async function placePreorder(options: { prep?: boolean } = {}) {
  const product = await makeProduct({
    name: "Es Kopi Susu",
    price: 18_000,
    stock: 20,
    prepType: options.prep === false ? "READY_TO_SERVE" : "NEEDS_PREP",
  });
  await makePickupSlot(SLOT, 20);

  return await createOrder({
    channel: "PREORDER",
    paymentStatus: "UNPAID",
    paymentMethod: "CASH",
    customerName: "Salsa",
    customerPhone: "081234567890",
    pickupSlot: SLOT,
    items: [{ productId: product.id, quantity: 2 }],
  });
}

async function reload(orderId: string) {
  const order = await db.orm.public.Order.where({ id: orderId }).first();
  if (!order) throw new Error(`Order ${orderId} not found`);
  return order;
}

beforeEach(async () => {
  await resetDatabase();
  session.user = null;
});

afterAll(async () => {
  await closeDatabase();
});

describe("markAsPaidAction", () => {
  it("settles the bill and credits it to the signed-in cashier", async () => {
    const kasir = await signIn("KASIR");
    const preorder = await placePreorder();

    const result = await markAsPaidAction({ orderId: preorder.id, cashReceived: 50_000 });

    expect(result.ok).toBe(true);

    const order = await reload(preorder.id);
    expect(order.paymentStatus).toBe("PAID");
    expect(order.cashReceived).toBe(50_000);
    expect(order.handledById).toBe(kasir.id);
  });

  it("takes the handler from the session, never from the request", async () => {
    const kasir = await signIn("KASIR");
    const impostor = await makeUser("ADMIN");
    const preorder = await placePreorder();

    await markAsPaidAction({ orderId: preorder.id, handledById: impostor.id });

    expect((await reload(preorder.id)).handledById).toBe(kasir.id);
  });

  it("turns away anyone who is not a cashier or an admin", async () => {
    await signIn("DAPUR");
    const preorder = await placePreorder();

    const result = await markAsPaidAction({ orderId: preorder.id });

    expect(result.ok).toBe(false);
    expect((await reload(preorder.id)).paymentStatus).toBe("UNPAID");
  });

  it("turns away a request with no session at all", async () => {
    const preorder = await placePreorder();
    session.user = null;

    expect((await markAsPaidAction({ orderId: preorder.id })).ok).toBe(false);
    expect((await reload(preorder.id)).paymentStatus).toBe("UNPAID");
  });

  it("refuses to settle the same order twice", async () => {
    await signIn("KASIR");
    const preorder = await placePreorder();

    await markAsPaidAction({ orderId: preorder.id, cashReceived: 40_000 });
    const second = await markAsPaidAction({ orderId: preorder.id, cashReceived: 100_000 });

    expect(second.ok).toBe(false);
    expect((await reload(preorder.id)).cashReceived).toBe(40_000);
  });
});

describe("transitionOrderAction", () => {
  it("sends a confirmed order to the kitchen", async () => {
    await signIn("KASIR");
    const preorder = await placePreorder();

    const result = await transitionOrderAction({ orderId: preorder.id, to: "IN_QUEUE" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.status).toBe("IN_QUEUE");

    const order = await reload(preorder.id);
    expect(order.status).toBe("IN_QUEUE");
    expect(order.queuedAt).not.toBeNull();
  });

  it("hands over an order with nothing to make", async () => {
    await signIn("KASIR");
    const preorder = await placePreorder({ prep: false });

    expect((await transitionOrderAction({ orderId: preorder.id, to: "DONE" })).ok).toBe(true);

    const order = await reload(preorder.id);
    expect(order.status).toBe("DONE");
    expect(order.completedAt).not.toBeNull();
  });

  it("leaves the transition table to the service, not to the screen", async () => {
    await signIn("KASIR");
    const preorder = await placePreorder();

    // No button offers this, but the POST can still be crafted by hand:
    // CONFIRMED → READY is not an edge at all.
    const result = await transitionOrderAction({ orderId: preorder.id, to: "READY" });

    expect(result.ok).toBe(false);
    expect((await reload(preorder.id)).status).toBe("CONFIRMED");
  });

  it("refuses an edge that exists but belongs to another role", async () => {
    await signIn("KASIR");
    const preorder = await placePreorder();

    await transitionOrderAction({ orderId: preorder.id, to: "IN_QUEUE" });

    // IN_QUEUE → IN_PROGRESS is the kitchen's move, not the counter's.
    const result = await transitionOrderAction({ orderId: preorder.id, to: "IN_PROGRESS" });

    expect(result.ok).toBe(false);
    expect((await reload(preorder.id)).status).toBe("IN_QUEUE");
  });

  it("turns away anyone who is not a cashier or an admin", async () => {
    await signIn("DAPUR");
    const preorder = await placePreorder();

    const result = await transitionOrderAction({ orderId: preorder.id, to: "IN_QUEUE" });

    expect(result.ok).toBe(false);
    expect((await reload(preorder.id)).status).toBe("CONFIRMED");
  });

  it("rejects a status that is not a status", async () => {
    await signIn("KASIR");
    const preorder = await placePreorder();

    expect((await transitionOrderAction({ orderId: preorder.id, to: "LUNAS" })).ok).toBe(false);
    expect((await reload(preorder.id)).status).toBe("CONFIRMED");
  });
});

/**
 * Two cashier tabs open on the same order. Both rendered the same snapshot, so
 * both resolved the same single action; the first one acts, and the second is
 * left holding a button for a move that has already happened.
 *
 * The screen's 15-second refresh normally redraws the stale tab before anyone
 * presses anything, but that is a convenience, not a guarantee — a cashier can
 * always press faster than the interval. `assertTransition` is the backstop,
 * and these tests are about it refusing rather than quietly applying the move a
 * second time.
 */
describe("dua tab kasir — the second tab is acting on a stale screen", () => {
  /** What one tab is showing at the moment it renders. */
  async function tabShowing(orderId: string): Promise<CashierPreorder> {
    const rows = await findPreordersForCashier();
    const row = rows.find((candidate) => candidate.id === orderId);
    if (!row) throw new Error(`Order ${orderId} not on the cashier's screen`);
    return toCashierPreorder(row);
  }

  it("refuses a second 'kirim ke dapur' from the tab still showing CONFIRMED", async () => {
    await signIn("KASIR");
    const preorder = await placePreorder();
    await markAsPaidAction({ orderId: preorder.id, cashReceived: 40_000 });

    const tabA = await tabShowing(preorder.id);
    const tabB = await tabShowing(preorder.id);

    // Both tabs offer the same one action, because both see CONFIRMED.
    const actionA = resolvePreorderAction(tabA);
    const actionB = resolvePreorderAction(tabB);
    expect(actionA).toMatchObject({ kind: "TRANSITION", to: "IN_QUEUE" });
    expect(actionB).toEqual(actionA);
    if (actionA.kind !== "TRANSITION" || actionB.kind !== "TRANSITION") return;

    const first = await transitionOrderAction({ orderId: tabA.id, to: actionA.to });
    expect(first.ok).toBe(true);

    const queuedAt = (await reload(preorder.id)).queuedAt;

    // The second tab presses its button, still believing the order is CONFIRMED.
    const second = await transitionOrderAction({ orderId: tabB.id, to: actionB.to });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toContain("IN_QUEUE");

    // Nothing moved, and the kitchen's clock was not restarted.
    const order = await reload(preorder.id);
    expect(order.status).toBe("IN_QUEUE");
    expect(order.queuedAt?.toString()).toBe(queuedAt?.toString());
  });

  it("refuses a second 'serahkan sekarang' from the tab still showing READY", async () => {
    await signIn("KASIR");
    const preorder = await placePreorder();
    await markAsPaidAction({ orderId: preorder.id, cashReceived: 40_000 });
    await transitionOrderAction({ orderId: preorder.id, to: "IN_QUEUE" });

    const dapur = await makeUser("DAPUR");
    await transitionStatus(preorder.id, "IN_PROGRESS", { id: dapur.id, role: "DAPUR" });
    await transitionStatus(preorder.id, "READY", { id: dapur.id, role: "DAPUR" });

    const tabA = await tabShowing(preorder.id);
    const tabB = await tabShowing(preorder.id);

    const actionA = resolvePreorderAction(tabA);
    const actionB = resolvePreorderAction(tabB);
    expect(actionA).toMatchObject({ kind: "TRANSITION", to: "DONE" });
    if (actionA.kind !== "TRANSITION" || actionB.kind !== "TRANSITION") return;

    expect((await transitionOrderAction({ orderId: tabA.id, to: actionA.to })).ok).toBe(true);

    const completedAt = (await reload(preorder.id)).completedAt;

    const second = await transitionOrderAction({ orderId: tabB.id, to: actionB.to });

    expect(second.ok).toBe(false);

    // DONE has no outgoing edges at all, so the handover is not re-stamped.
    const order = await reload(preorder.id);
    expect(order.status).toBe("DONE");
    expect(order.completedAt?.toString()).toBe(completedAt?.toString());
  });

  it("refuses a second 'terima pembayaran' from the tab still showing UNPAID", async () => {
    await signIn("KASIR");
    const preorder = await placePreorder();

    const tabA = await tabShowing(preorder.id);
    const tabB = await tabShowing(preorder.id);

    expect(resolvePreorderAction(tabA).kind).toBe("PAY");
    expect(resolvePreorderAction(tabB).kind).toBe("PAY");

    expect((await markAsPaidAction({ orderId: tabA.id, cashReceived: 40_000 })).ok).toBe(true);

    // The stale tab's cash box still holds what its cashier typed.
    const second = await markAsPaidAction({ orderId: tabB.id, cashReceived: 100_000 });

    expect(second.ok).toBe(false);
    expect((await reload(preorder.id)).cashReceived).toBe(40_000);
  });

  it("gives the stale tab a disabled button as soon as it refreshes", async () => {
    await signIn("KASIR");
    const preorder = await placePreorder();
    await markAsPaidAction({ orderId: preorder.id, cashReceived: 40_000 });

    await transitionOrderAction({ orderId: preorder.id, to: "IN_QUEUE" });

    // What the second tab draws once its 15-second refresh lands: no button to
    // press wrongly in the first place.
    expect(resolvePreorderAction(await tabShowing(preorder.id))).toMatchObject({
      kind: "BLOCKED",
      label: "Tunggu dapur selesai dulu",
    });
  });
});
