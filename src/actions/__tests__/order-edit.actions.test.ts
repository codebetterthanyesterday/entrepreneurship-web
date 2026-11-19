import { Temporal } from "@js-temporal/polyfill";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ user: null as { id: string; role: string } | null }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/session", async () => {
  const { ForbiddenError, UnauthorizedError } = await import("@/lib/errors");
  return {
    requireRole: async (...roles: string[]) => {
      if (!session.user) throw new UnauthorizedError();
      if (!roles.includes(session.user.role)) throw new ForbiddenError();
      return session.user;
    },
    toActor: (user: { id: string; role: string }) => ({ id: user.id, role: user.role }),
  };
});

const { updateOrderDetailsAction } = await import("@/actions/kasir.actions");
const { prisma: db } = await import("@/lib/prisma");
const { createOrder } = await import("@/lib/services/order.service");
const { openServiceDay } = await import("@/lib/services/schedule.service");
const { todayInJakarta } = await import("@/lib/schedule");
const { closeDatabase, makeProduct, makeUser, resetDatabase } = await import(
  "@/lib/services/__tests__/helpers/test-db"
);

beforeEach(async () => {
  await resetDatabase();
  session.user = null;
});

afterAll(async () => {
  await closeDatabase();
});

async function placePreorder() {
  const day = await openServiceDay({
    date: Temporal.PlainDate.from(todayInJakarta()).add({ days: 5 }).toString(),
    locations: ["CAMPUS_B"],
    windows: [{ startMinute: 600, endMinute: 660, quota: 5 }],
  });
  const window = (await db.orm.public.ServiceWindow.where({ dayId: day.id }).first())!;
  const product = await makeProduct();
  return await createOrder({
    channel: "PREORDER",
    paymentStatus: "UNPAID",
    customerName: "Rani",
    customerPhone: "081234561234",
    paymentMethod: "CASH",
    schedule: { location: "CAMPUS_B", detail: null, serviceWindowId: window.id },
    items: [{ productId: product.id, quantity: 1 }],
  });
}

describe("updateOrderDetailsAction", () => {
  it("is for the cashier and the admin, not the kitchen", async () => {
    const order = await placePreorder();
    const dapur = await makeUser("DAPUR");
    session.user = { id: dapur.id, role: "DAPUR" };

    const input = { orderId: order.id, customerName: "Rani Putri", customerPhone: "081234561234", schedule: null };
    expect((await updateOrderDetailsAction(input)).ok).toBe(false);

    const kasir = await makeUser("KASIR");
    session.user = { id: kasir.id, role: "KASIR" };
    expect(await updateOrderDetailsAction(input)).toMatchObject({ ok: true, data: { orderNumber: order.orderNumber } });
    expect((await db.orm.public.Order.where({ id: order.id }).first())!.customerName).toBe("Rani Putri");
  });

  it("points a wrong number at its field", async () => {
    const order = await placePreorder();
    const kasir = await makeUser("KASIR");
    session.user = { id: kasir.id, role: "KASIR" };

    const result = await updateOrderDetailsAction({
      orderId: order.id,
      customerName: "Rani",
      customerPhone: "12345",
      schedule: null,
    });
    expect(result).toMatchObject({ ok: false, field: "customerPhone" });
  });
});
