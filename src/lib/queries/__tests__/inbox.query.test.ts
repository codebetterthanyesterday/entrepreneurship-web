import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { buildInbox } from "@/lib/inbox";
import { loadInboxSnapshot } from "@/lib/queries/inbox.query";
import { LOCATION_REJECTED_REASON } from "@/lib/customer-chat";
import { cancelOrder, createOrder, markAsPaid } from "@/lib/services/order.service";
import {
  closeDatabase,
  makeProduct,
  makeUser,
  openPreorderWindow,
  resetDatabase,
} from "@/lib/services/__tests__/helpers/test-db";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

async function preorder(name: string, location: "MARKET_DAY" | "OTHER" = "MARKET_DAY") {
  const product = await makeProduct({ stock: 10 });
  const schedule = await openPreorderWindow("09.00 - 10.00", 10);
  return await createOrder({
    channel: "PREORDER",
    paymentStatus: "UNPAID",
    paymentMethod: "CASH",
    customerName: name,
    customerPhone: "081234561234",
    schedule: {
      ...schedule,
      location,
      detail: location === "OTHER" ? "Kos Melati nomor empat" : null,
    },
    items: [{ productId: product.id, quantity: 1 }],
  });
}

describe("loadInboxSnapshot", () => {
  it("reads the orders still open and a turned-away “Lainnya” one, never a finished or plainly cancelled one", async () => {
    const kasir = await makeUser("KASIR");
    const actor = { id: kasir.id, role: kasir.role };

    const open = await preorder("Masih buka");
    const finished = await preorder("Udah lunas");
    await markAsPaid(finished.id, { id: kasir.id, role: kasir.role });
    await cancelOrder(finished.id, actor);
    const cancelled = await preorder("Batal biasa");
    await cancelOrder(cancelled.id, actor);
    const rejected = await preorder("Lokasi jauh", "OTHER");
    await cancelOrder(rejected.id, actor, LOCATION_REJECTED_REASON);

    const snapshot = await loadInboxSnapshot();
    const numbers = snapshot.orders.map((order) => order.orderNumber).sort();
    expect(numbers).toEqual([open.orderNumber, rejected.orderNumber].sort());

    // The turned-away customer is still to be told.
    const items = buildInbox(snapshot, "KASIR", Temporal.Now.instant());
    expect(items.map((item) => item.key)).toContain(`location-notice:${rejected.orderNumber}`);
  });

  it("carries each order's time range end, for telling when a customer is late", async () => {
    await preorder("Rani");
    const [order] = (await loadInboxSnapshot()).orders;
    expect(order?.windowEndMinute).toBe(10 * 60);
    expect(order?.pickupSlot).toBe("09.00 - 10.00");
  });

  it("reads open dates from today on with their places taken", async () => {
    await preorder("Rani");
    const { windows } = await loadInboxSnapshot();
    expect(windows).toEqual([expect.objectContaining({ label: "09.00 - 10.00", quota: 10, booked: 1 })]);
  });
});
