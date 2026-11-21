import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { buildInbox, type InboxOrder, type InboxSnapshot } from "@/lib/inbox";
import { LOCATION_REJECTED_REASON } from "@/lib/customer-chat";

/** 22 Nov 2026, 12:30 in Jakarta. */
const NOW = Temporal.Instant.from("2026-11-22T05:30:00Z");
const TODAY = "2026-11-22";

function order(overrides: Partial<InboxOrder> = {}): InboxOrder {
  return {
    id: "o1",
    orderNumber: "PO-7KX4QM",
    channel: "PREORDER",
    status: "CONFIRMED",
    paymentStatus: "UNPAID",
    paymentMethod: "CASH",
    customerName: "Rani",
    customerPhone: "081234561234",
    totalAmount: 20_000,
    hasPaymentProof: false,
    serviceDate: TODAY,
    pickupSlot: "13.00 - 14.00",
    windowEndMinute: 14 * 60,
    handoverLocation: "MARKET_DAY",
    handoverDetail: null,
    locationReviewedAt: null,
    locationNotifiedAt: null,
    notes: null,
    createdAt: "2026-11-21T10:00:00Z",
    updatedAt: "2026-11-21T10:00:00Z",
    queuedAt: null,
    readyAt: null,
    ...overrides,
  };
}

function snapshot(overrides: Partial<InboxSnapshot> = {}): InboxSnapshot {
  return { orders: [], products: [], bundles: [], windows: [], lowStockThreshold: 3, ...overrides };
}

const kinds = (s: InboxSnapshot, role: "KASIR" | "DAPUR" | "ADMIN" = "KASIR", now = NOW) =>
  buildInbox(s, role, now).map((item) => item.kind);

describe("the staff inbox", () => {
  it("asks the cashier to check a QRIS receipt, and lets go once the order is paid", () => {
    const proof = order({ paymentMethod: "QRIS", hasPaymentProof: true });
    const [item] = buildInbox(snapshot({ orders: [proof] }), "KASIR", NOW);
    expect(item).toMatchObject({ kind: "qris-proof", tone: "urgent", href: "/kasir/preorder?pesanan=PO-7KX4QM" });

    expect(kinds(snapshot({ orders: [{ ...proof, paymentStatus: "PAID" }] }))).toEqual([]);
    // No receipt yet: nothing to check.
    expect(kinds(snapshot({ orders: [{ ...proof, hasPaymentProof: false }] }))).toEqual([]);
  });

  it("asks for a “Lainnya” location to be checked, then for the customer to be told", () => {
    const other = order({ handoverLocation: "OTHER", handoverDetail: "Kos Melati no. 4" });
    expect(kinds(snapshot({ orders: [other] }))).toEqual(["location-check"]);

    const accepted = { ...other, locationReviewedAt: "2026-11-22T04:00:00Z" };
    expect(kinds(snapshot({ orders: [accepted] }))).toEqual(["location-notice"]);
    expect(kinds(snapshot({ orders: [{ ...accepted, locationNotifiedAt: "2026-11-22T04:10:00Z" }] }))).toEqual([]);

    // Turned away is cancelled, and the customer still has to hear it.
    const rejected = { ...other, status: "CANCELLED" as const, notes: LOCATION_REJECTED_REASON };
    expect(kinds(snapshot({ orders: [rejected] }))).toEqual(["location-notice"]);
  });

  it("puts a preorder ready to hand over in front of the cashier", () => {
    expect(kinds(snapshot({ orders: [order({ status: "READY", paymentStatus: "PAID" })] }))).toEqual(["ready"]);
    expect(kinds(snapshot({ orders: [order({ status: "DONE", paymentStatus: "PAID" })] }))).toEqual([]);
  });

  it(`flags a customer who has not come ${15} minutes after their time range ended`, () => {
    // Range 11.00 - 12.00, now 12.30: late.
    const late = order({ pickupSlot: "11.00 - 12.00", windowEndMinute: 12 * 60 });
    const [item] = buildInbox(snapshot({ orders: [late] }), "KASIR", NOW);
    expect(item).toMatchObject({ kind: "late-pickup", title: "Pelanggan belum datang" });

    // Range ends 12.20: only 10 minutes over, not yet.
    expect(kinds(snapshot({ orders: [order({ windowEndMinute: 12 * 60 + 20 })] }))).toEqual([]);
    // Another day's order is not late today.
    expect(kinds(snapshot({ orders: [{ ...late, serviceDate: "2026-11-23" }] }))).toEqual([]);
    // A delivered one is "not delivered yet", not "has not come".
    expect(buildInbox(snapshot({ orders: [{ ...late, handoverLocation: "CAMPUS_B" }] }), "KASIR", NOW)[0]?.title).toBe(
      "Belum diantar",
    );
  });

  it("tells the kitchen when an order has waited more than ten minutes, and nobody else but admin", () => {
    const waiting = order({ status: "IN_QUEUE", queuedAt: "2026-11-22T05:19:00Z" });
    expect(kinds(snapshot({ orders: [waiting] }), "DAPUR")).toEqual(["kitchen-wait"]);
    expect(kinds(snapshot({ orders: [waiting] }), "KASIR")).toEqual([]);
    expect(kinds(snapshot({ orders: [waiting] }), "ADMIN")).toEqual(["kitchen-wait"]);
    expect(kinds(snapshot({ orders: [{ ...waiting, queuedAt: "2026-11-22T05:25:00Z" }] }), "DAPUR")).toEqual([]);
  });

  it("shows the admin what to keep an eye on: stock, full time ranges, pakets that cannot sell", () => {
    const s = snapshot({
      products: [
        { id: "p1", name: "Kopi", stock: 0, isActive: true },
        { id: "p2", name: "Croffle", stock: 2, isActive: true },
        { id: "p3", name: "Puding", stock: 20, isActive: true },
        { id: "p4", name: "Lama", stock: 0, isActive: false },
      ],
      bundles: [{ id: "b1", name: "Combo", isActive: true, items: [{ productId: "p1", quantity: 1 }] }],
      windows: [
        { date: TODAY, label: "11.00 - 12.00", quota: 10, booked: 10 },
        { date: TODAY, label: "12.00 - 13.00", quota: 10, booked: 3 },
      ],
    });
    expect(kinds(s, "ADMIN").sort()).toEqual(["bundle-unavailable", "stock-low", "stock-out", "window-full"].sort());
    expect(kinds(s, "KASIR")).toEqual([]);
    expect(kinds(s, "DAPUR")).toEqual([]);
  });

  it("lists the most pressing first, and the longest waiting first within that", () => {
    const items = buildInbox(
      snapshot({
        orders: [
          order({ orderNumber: "PO-READY", status: "READY", paymentStatus: "PAID", readyAt: "2026-11-22T05:00:00Z" }),
          order({ orderNumber: "PO-NEWER", paymentMethod: "QRIS", hasPaymentProof: true, updatedAt: "2026-11-22T05:20:00Z" }),
          order({ orderNumber: "PO-OLDER", paymentMethod: "QRIS", hasPaymentProof: true, updatedAt: "2026-11-22T05:10:00Z" }),
        ],
      }),
      "KASIR",
      NOW,
    );
    expect(items.map((item) => item.key)).toEqual(["qris-proof:PO-OLDER", "qris-proof:PO-NEWER", "ready:PO-READY"]);
  });

  it("is empty when there is nothing to do", () => {
    expect(kinds(snapshot({ orders: [order({ status: "DONE", paymentStatus: "PAID" })] }), "ADMIN")).toEqual([]);
  });
});
