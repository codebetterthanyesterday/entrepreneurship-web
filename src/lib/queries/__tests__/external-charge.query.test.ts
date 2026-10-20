import { Temporal } from "@js-temporal/polyfill";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { findActiveCharges } from "@/lib/queries/external-charge.query";
import { findByNumber, toTrackedOrder } from "@/lib/queries/order.query";
import {
  getOrdersForExport,
  getPhotoboothChargesForExport,
  getSalesSummary,
} from "@/lib/queries/report.query";
import {
  recordPhotoboothCharge,
  voidPhotoboothCharge,
} from "@/lib/services/external-charge.service";
import { createOrder } from "@/lib/services/order.service";
import {
  closeDatabase,
  makePickupSlot,
  makeProduct,
  resetDatabase,
} from "@/lib/services/__tests__/helpers/test-db";

/*
 * BPB-098: photobooth charges on the note, kept apart from the food in
 * every view and report.
 */

let kopi: { id: string };

async function paidPreorder() {
  return await createOrder({
    channel: "PREORDER",
    items: [{ productId: kopi.id, quantity: 2 }],
    customerName: "Nadia Prameswari",
    customerPhone: "081234560042",
    pickupSlot: "09.00 - 10.00",
    paymentMethod: "CASH",
    paymentStatus: "PAID",
  });
}

async function charge(orderNumber: string, externalId: string, amount: number, minute: number) {
  const outcome = await recordPhotoboothCharge({
    externalId,
    orderNumber,
    description: `Cetak ${amount}`,
    amount,
    paidAt: Temporal.Instant.from(`2026-12-05T03:${String(minute).padStart(2, "0")}:00Z`),
  });
  expect(outcome.kind).toBe("created");
}

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

beforeEach(async () => {
  await resetDatabase();
  kopi = await makeProduct({ name: "Es Kopi Aren", price: 18_000, stock: 100 });
  await makePickupSlot("09.00 - 10.00", 100);
});

afterAll(async () => {
  await closeDatabase();
});

describe("findActiveCharges", () => {
  it("gives each order its paid charges in the order they were paid, leaving voided ones out", async () => {
    const first = await paidPreorder();
    const second = await paidPreorder();
    await charge(first.orderNumber, B, 15_000, 10);
    await charge(first.orderNumber, A, 8_000, 5);
    await charge(first.orderNumber, C, 12_000, 20);
    await voidPhotoboothCharge(C, Temporal.Instant.from("2026-12-05T04:00:00Z"));

    const charges = await findActiveCharges([first.id, second.id]);
    expect(charges.get(first.id)).toEqual([
      { key: A, description: "Cetak 8000", amount: 8_000 },
      { key: B, description: "Cetak 15000", amount: 15_000 },
    ]);
    expect(charges.get(second.id)).toEqual([]);
  });

  it("goes on the tracked order without touching its food total", async () => {
    const order = await paidPreorder();
    await charge(order.orderNumber, A, 8_000, 5);
    const found = (await findByNumber(order.orderNumber))!;
    const tracked = toTrackedOrder(found, (await findActiveCharges([found.id])).get(found.id));
    expect(tracked.totalAmount).toBe(36_000);
    expect(tracked.photobooth).toEqual([{ key: A, description: "Cetak 8000", amount: 8_000 }]);
  });
});

describe("reports keep the photobooth apart from food", () => {
  it("the summary counts photobooth revenue separately, voided charges left out", async () => {
    const order = await paidPreorder();
    await charge(order.orderNumber, A, 8_000, 5);
    await charge(order.orderNumber, B, 15_000, 10);
    await voidPhotoboothCharge(B, Temporal.Instant.from("2026-12-05T04:00:00Z"));

    const summary = await getSalesSummary();
    expect(summary.totalRevenue).toBe(36_000);
    expect(summary.photoboothRevenue).toBe(8_000);
  });

  it("the order export carries the photobooth amount in its own column", async () => {
    const order = await paidPreorder();
    await paidPreorder();
    await charge(order.orderNumber, A, 8_000, 5);

    const rows = await getOrdersForExport();
    expect(rows.map((row) => [row.orderNumber, row.totalAmount, row.photoboothAmount])).toEqual([
      [order.orderNumber, 36_000, 8_000],
      ["PO-0002", 36_000, 0],
    ]);
  });

  it("the photobooth export lists every charge, voided ones with when they were voided", async () => {
    const order = await paidPreorder();
    await charge(order.orderNumber, A, 8_000, 5);
    await charge(order.orderNumber, B, 15_000, 10);
    await voidPhotoboothCharge(B, Temporal.Instant.from("2026-12-05T04:00:00Z"));

    const rows = await getPhotoboothChargesForExport();
    expect(rows).toEqual([
      expect.objectContaining({
        orderNumber: order.orderNumber,
        customerName: "Nadia Prameswari",
        amount: 8_000,
        voidedAt: "",
      }),
      expect.objectContaining({ amount: 15_000, voidedAt: "2026-12-05 11:00" }),
    ]);
  });
});
