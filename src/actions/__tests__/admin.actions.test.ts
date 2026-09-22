import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// revalidatePath needs a request scope that does not exist in a test process.
// The action's caching behaviour is not what these tests are about.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// There is no request, so no NextAuth session either. The signed-in user is
// whatever the test puts here; requireRole keeps its real role check.
const session = vi.hoisted(() => ({
  user: null as { id: string; name: string; role: string } | null,
}));

// The mock replaces the whole module, so anything the action imports from it
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

const { cancelOrderAction } = await import("@/actions/admin.actions");
const { createOrder, transitionStatus } = await import("@/lib/services/order.service");
const { getAllOrders } = await import("@/lib/queries/report.query");
const {
  closeDatabase,
  makePickupSlot,
  makeProduct,
  makeUser,
  resetDatabase,
  slotByLabel,
  stockOf,
} = await import("@/lib/services/__tests__/helpers/test-db");

const SLOT = "09.00 - 10.00";

async function signIn(role: "ADMIN" | "KASIR" | "DAPUR") {
  const user = await makeUser(role);
  session.user = { id: user.id, name: user.name, role };
  return user;
}

beforeEach(async () => {
  await resetDatabase();
  session.user = null;
  await makePickupSlot(SLOT, 20);
});

afterAll(async () => {
  await closeDatabase();
});

async function placePreorder(productId: string, quantity = 2) {
  return await createOrder({
    channel: "PREORDER",
    paymentStatus: "UNPAID",
    paymentMethod: "CASH",
    customerName: "Rani",
    customerPhone: "081234567890",
    pickupSlot: SLOT,
    items: [{ productId, quantity }],
  });
}

describe("cancelOrderAction", () => {
  it("turns away a request with no session", async () => {
    const product = await makeProduct({ stock: 20 });
    const order = await placePreorder(product.id);

    const result = await cancelOrderAction({ orderId: order.id });

    expect(result.ok).toBe(false);
    // The order is untouched — nothing was voided on an anonymous request.
    expect(await stockOf(product.id)).toBe(18);
  });

  it.each(["KASIR", "DAPUR"] as const)("turns away a %s", async (role) => {
    const product = await makeProduct({ stock: 20 });
    const order = await placePreorder(product.id);
    await signIn(role);

    const result = await cancelOrderAction({ orderId: order.id });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("akses");
    expect(await stockOf(product.id)).toBe(18);
  });

  it("voids the order and hands its stock back", async () => {
    const product = await makeProduct({ stock: 20 });
    const order = await placePreorder(product.id, 3);
    expect(await stockOf(product.id)).toBe(17);

    await signIn("ADMIN");
    const result = await cancelOrderAction({ orderId: order.id });

    expect(result).toEqual({ ok: true, data: { orderNumber: order.orderNumber } });
    expect(await stockOf(product.id)).toBe(20);
  });

  it("frees the place the preorder held in its pickup slot", async () => {
    const product = await makeProduct({ stock: 20 });
    const order = await placePreorder(product.id);
    expect((await slotByLabel(SLOT)).booked).toBe(1);

    await signIn("ADMIN");
    await cancelOrderAction({ orderId: order.id });

    // Without this the slot would slowly starve: every cancellation would
    // leave its place permanently taken.
    expect((await slotByLabel(SLOT)).booked).toBe(0);
  });

  it("leaves the order in the admin's list, marked cancelled", async () => {
    const product = await makeProduct({ stock: 20 });
    const order = await placePreorder(product.id);

    await signIn("ADMIN");
    await cancelOrderAction({ orderId: order.id });

    const page = await getAllOrders();

    expect(page.total).toBe(1);
    expect(page.orders[0]?.status).toBe("CANCELLED");
    // Listed, but worth nothing.
    expect(page.totalAmount).toBe(0);
  });

  it("refuses an order that has already been handed over", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ stock: 20 });
    const order = await placePreorder(product.id);
    await transitionStatus(order.id, "DONE", { id: kasir.id, role: "KASIR" });

    await signIn("ADMIN");
    const result = await cancelOrderAction({ orderId: order.id });

    // DONE has no CANCELLED edge in the transition table, and the action does
    // not get to second-guess it.
    expect(result.ok).toBe(false);
    expect(await stockOf(product.id)).toBe(18);
  });

  it("refuses a second cancellation of the same order", async () => {
    const product = await makeProduct({ stock: 20 });
    const order = await placePreorder(product.id);

    await signIn("ADMIN");
    expect((await cancelOrderAction({ orderId: order.id })).ok).toBe(true);

    const second = await cancelOrderAction({ orderId: order.id });

    // Stock came back exactly once. A second void that "succeeded" would put
    // the units back twice and leave the product with more than it ever had.
    expect(second.ok).toBe(false);
    expect(await stockOf(product.id)).toBe(20);
  });

  it("reports an unknown order rather than throwing", async () => {
    await signIn("ADMIN");

    const result = await cancelOrderAction({ orderId: "tidak-ada" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("nggak ketemu");
  });

  it("rejects a malformed request before reaching the service", async () => {
    await signIn("ADMIN");

    expect((await cancelOrderAction({})).ok).toBe(false);
    expect((await cancelOrderAction({ orderId: "" })).ok).toBe(false);
    expect((await cancelOrderAction(null)).ok).toBe(false);
  });

  it("records the reason on the order when one is given", async () => {
    const product = await makeProduct({ stock: 20 });
    const order = await placePreorder(product.id);

    await signIn("ADMIN");
    await cancelOrderAction({ orderId: order.id, reason: "Pelanggan nggak datang" });

    const page = await getAllOrders();

    expect(page.orders[0]?.notes).toContain("Pelanggan nggak datang");
  });
});
