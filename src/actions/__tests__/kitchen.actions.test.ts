import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// revalidatePath needs a request scope that does not exist in a test process.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// There is no request, so no NextAuth session either. The signed-in user is
// whatever the test puts here; requireRole keeps its real role check.
const session = vi.hoisted(() => ({
  user: null as { id: string; name: string; role: string } | null,
}));

// The real module is not imported even for `toActor`: it pulls in NextAuth,
// which reaches for `next/server` and does not resolve outside a request. The
// helper is two lines, so the mock carries its own copy.
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

const { transitionFromKitchenAction } = await import("@/actions/kitchen.actions");
const { createOrder, transitionStatus } = await import("@/lib/services/order.service");
const { closeDatabase, db, makeProduct, makeUser, resetDatabase } = await import(
  "@/lib/services/__tests__/helpers/test-db"
);

async function signIn(role: "DAPUR" | "KASIR" | "ADMIN") {
  const user = await makeUser(role);
  session.user = { id: user.id, name: user.name, role };
  return user;
}

/** An on-the-spot sale with something to make lands straight in the queue. */
async function queuedOrder() {
  const product = await makeProduct({ stock: 20, prepType: "NEEDS_PREP" });

  return await createOrder({
    channel: "ONSITE",
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    customerName: "Pelanggan booth",
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

describe("transitionFromKitchenAction — forward", () => {
  it("starts a ticket and stamps when work began", async () => {
    await signIn("DAPUR");
    const order = await queuedOrder();

    const result = await transitionFromKitchenAction({ orderId: order.id, to: "IN_PROGRESS" });

    expect(result.ok).toBe(true);

    const row = await reload(order.id);
    expect(row.status).toBe("IN_PROGRESS");
    expect(row.startedAt).not.toBeNull();
  });

  it("marks a ticket ready", async () => {
    const dapur = await signIn("DAPUR");
    const order = await queuedOrder();
    await transitionStatus(order.id, "IN_PROGRESS", { id: dapur.id, role: "DAPUR" });

    expect((await transitionFromKitchenAction({ orderId: order.id, to: "READY" })).ok).toBe(true);
    expect((await reload(order.id)).readyAt).not.toBeNull();
  });

  it("hands a ticket over", async () => {
    const dapur = await signIn("DAPUR");
    const order = await queuedOrder();
    await transitionStatus(order.id, "IN_PROGRESS", { id: dapur.id, role: "DAPUR" });
    await transitionStatus(order.id, "READY", { id: dapur.id, role: "DAPUR" });

    expect((await transitionFromKitchenAction({ orderId: order.id, to: "DONE" })).ok).toBe(true);
    expect((await reload(order.id)).status).toBe("DONE");
  });
});

/**
 * The way back from every stage. A mis-tap with wet hands is a real thing, and
 * without these a single wrong tap leaves the order's status wrong for the rest
 * of the event — on the counter's screen and the customer's tracking page too.
 */
describe("transitionFromKitchenAction — the way back", () => {
  it("puts a ticket back in the queue", async () => {
    const dapur = await signIn("DAPUR");
    const order = await queuedOrder();
    await transitionStatus(order.id, "IN_PROGRESS", { id: dapur.id, role: "DAPUR" });

    expect((await transitionFromKitchenAction({ orderId: order.id, to: "IN_QUEUE" })).ok).toBe(
      true,
    );
    expect((await reload(order.id)).status).toBe("IN_QUEUE");
  });

  it("puts a ticket marked ready by mistake back on the stove", async () => {
    const dapur = await signIn("DAPUR");
    const order = await queuedOrder();
    await transitionStatus(order.id, "IN_PROGRESS", { id: dapur.id, role: "DAPUR" });
    await transitionStatus(order.id, "READY", { id: dapur.id, role: "DAPUR" });

    expect((await transitionFromKitchenAction({ orderId: order.id, to: "IN_PROGRESS" })).ok).toBe(
      true,
    );
    expect((await reload(order.id)).status).toBe("IN_PROGRESS");
  });

  it("cannot undo a handover — DONE is the end of the line", async () => {
    const dapur = await signIn("DAPUR");
    const order = await queuedOrder();
    await transitionStatus(order.id, "IN_PROGRESS", { id: dapur.id, role: "DAPUR" });
    await transitionStatus(order.id, "READY", { id: dapur.id, role: "DAPUR" });
    await transitionStatus(order.id, "DONE", { id: dapur.id, role: "DAPUR" });

    const result = await transitionFromKitchenAction({ orderId: order.id, to: "READY" });

    expect(result.ok).toBe(false);
    expect((await reload(order.id)).status).toBe("DONE");
  });
});

describe("transitionFromKitchenAction — who may move a ticket", () => {
  it("turns away a cashier", async () => {
    await signIn("KASIR");
    const order = await queuedOrder();

    const result = await transitionFromKitchenAction({ orderId: order.id, to: "IN_PROGRESS" });

    expect(result.ok).toBe(false);
    expect((await reload(order.id)).status).toBe("IN_QUEUE");
  });

  it("turns away a request with no session", async () => {
    const order = await queuedOrder();
    session.user = null;

    expect((await transitionFromKitchenAction({ orderId: order.id, to: "IN_PROGRESS" })).ok).toBe(
      false,
    );
  });

  it("lets an admin past the role gate but not past the transition table", async () => {
    await signIn("ADMIN");
    const order = await queuedOrder();

    // Chapter 3 gives the kitchen edges to DAPUR alone. The action does not
    // restate that rule; `assertTransition` applies it. This is why the board
    // draws an admin's buttons disabled rather than letting them fail on tap.
    const result = await transitionFromKitchenAction({ orderId: order.id, to: "IN_PROGRESS" });

    expect(result.ok).toBe(false);
    expect((await reload(order.id)).status).toBe("IN_QUEUE");
  });

  it("leaves the transition table to the service", async () => {
    await signIn("DAPUR");
    const order = await queuedOrder();

    // No button offers it: IN_QUEUE straight to READY is not an edge.
    const result = await transitionFromKitchenAction({ orderId: order.id, to: "READY" });

    expect(result.ok).toBe(false);
    expect((await reload(order.id)).status).toBe("IN_QUEUE");
  });

  it("rejects a status that is not a status", async () => {
    await signIn("DAPUR");
    const order = await queuedOrder();

    expect((await transitionFromKitchenAction({ orderId: order.id, to: "MATANG" })).ok).toBe(
      false,
    );
  });
});

/**
 * Two tablets on the pass, both showing the same ticket. Same guarantee as the
 * counter: whichever taps second is refused rather than quietly re-applying a
 * move that already happened.
 */
describe("transitionFromKitchenAction — two tablets on one ticket", () => {
  it("refuses the second tap from a tablet that has not refreshed", async () => {
    await signIn("DAPUR");
    const order = await queuedOrder();

    const first = await transitionFromKitchenAction({ orderId: order.id, to: "IN_PROGRESS" });
    expect(first.ok).toBe(true);

    const startedAt = (await reload(order.id)).startedAt;

    const second = await transitionFromKitchenAction({ orderId: order.id, to: "IN_PROGRESS" });

    expect(second.ok).toBe(false);

    const row = await reload(order.id);
    expect(row.status).toBe("IN_PROGRESS");
    expect(row.startedAt?.toString()).toBe(startedAt?.toString());
  });

  it("applies the move once when both tablets tap at the same instant", async () => {
    await signIn("DAPUR");
    const order = await queuedOrder();

    const results = await Promise.allSettled([
      transitionFromKitchenAction({ orderId: order.id, to: "IN_PROGRESS" }),
      transitionFromKitchenAction({ orderId: order.id, to: "IN_PROGRESS" }),
    ]);

    const accepted = results.filter(
      (result) => result.status === "fulfilled" && result.value.ok,
    );

    expect(accepted).toHaveLength(1);
    expect((await reload(order.id)).status).toBe("IN_PROGRESS");
  });
});
