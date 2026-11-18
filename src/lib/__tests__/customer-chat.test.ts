import { describe, expect, it } from "vitest";
import {
  LOCATION_REJECTED_REASON,
  composeCustomerMessage,
  customerTemplates,
  needsLocationNotice,
  type StaffChatOrder,
} from "@/lib/customer-chat";

const TODAY = "2026-11-20";
const CONTEXT = { brand: "Bunnyè", origin: "https://bunnye.vercel.app" };

function order(overrides: Partial<StaffChatOrder> = {}): StaffChatOrder {
  return {
    orderNumber: "PO-0016",
    customerName: "Rani",
    customerPhone: "081234561234",
    status: "CONFIRMED",
    paymentMethod: "CASH",
    paymentStatus: "UNPAID",
    hasPaymentProof: false,
    totalAmount: 18_000,
    serviceDate: "2026-11-21",
    pickupSlot: "13.00 - 14.00",
    handoverLocation: "CAMPUS_B",
    handoverDetail: "Depan gazebo",
    awaitingLocationCheck: false,
    locationNotifiedAt: null,
    notes: null,
    ...overrides,
  };
}

const lainnya = (overrides: Partial<StaffChatOrder> = {}) =>
  order({ handoverLocation: "OTHER", handoverDetail: "Kos Melati", ...overrides });
const rejected = (overrides: Partial<StaffChatOrder> = {}) =>
  lainnya({ status: "CANCELLED", notes: `Dibatalin: ${LOCATION_REJECTED_REASON}: terlalu jauh`, ...overrides });

describe("customerTemplates", () => {
  it("asks for a landmark while a Lainnya location is being checked, and offers nothing it cannot say yet", () => {
    expect(customerTemplates(lainnya({ awaitingLocationCheck: true }))).toEqual(["askLandmark", "general"]);
  });

  it("leads with the verdict once a Lainnya location is checked", () => {
    expect(customerTemplates(lainnya())[0]).toBe("locationAccepted");
    expect(customerTemplates(rejected())).toEqual(["locationRejected", "general"]);
  });

  it("does not call an order cancelled for another reason a rejected location", () => {
    expect(customerTemplates(lainnya({ status: "CANCELLED", notes: "Dibatalin" }))).toEqual(["general"]);
  });

  it("reminds about QRIS only while nothing has been sent", () => {
    expect(customerTemplates(order({ paymentMethod: "QRIS" }))).toContain("paymentReminder");
    expect(customerTemplates(order({ paymentMethod: "QRIS", hasPaymentProof: true }))).not.toContain(
      "paymentReminder",
    );
    expect(customerTemplates(order({ paymentMethod: "QRIS", paymentStatus: "PAID" }))).not.toContain(
      "paymentReminder",
    );
  });

  it("says ready to collect at Market Day, and on the way to a campus", () => {
    expect(customerTemplates(order({ handoverLocation: "MARKET_DAY" }))).toContain("ready");
    expect(customerTemplates(order({ handoverLocation: "MARKET_DAY" }))).not.toContain("onTheWay");
    expect(customerTemplates(order({ handoverLocation: "CAMPUS_C" }))).toContain("onTheWay");
  });

  it("has only a plain chat for a finished order", () => {
    expect(customerTemplates(order({ status: "DONE" }))).toEqual(["general"]);
  });
});

describe("composeCustomerMessage", () => {
  it("signs with the brand and names the customer and the order", () => {
    const text = composeCustomerMessage("general", order(), CONTEXT);
    expect(text).toBe("Halo Rani, ini Bunnyè. Soal pesanan PO-0016: ");
  });

  it("tells an accepted Lainnya customer the schedule, and where to pay a QRIS still owed", () => {
    const text = composeCustomerMessage("locationAccepted", lainnya({ paymentMethod: "QRIS" }), CONTEXT);
    expect(text).toContain("bisa kami jangkau");
    expect(text).toContain("Jadwal: Sabtu, 21 Nov 2026 · 13.00 - 14.00 · Lainnya · Kos Melati");
    expect(text).toContain("https://bunnye.vercel.app/pesanan/PO-0016");
  });

  it("offers a rejected customer the other places, and their money back when they paid", () => {
    const unpaid = composeCustomerMessage("locationRejected", rejected(), CONTEXT);
    expect(unpaid).toContain('lokasi "Kos Melati" di luar jangkauan');
    expect(unpaid).toContain("Kampus B (Halimun), Kampus C (Minangkabau) atau Market Day");
    expect(unpaid).not.toContain("kembalikan");

    const paid = composeCustomerMessage("locationRejected", rejected({ paymentStatus: "PAID" }), CONTEXT);
    expect(paid).toContain("Pembayaranmu kami kembalikan");
  });

  it("gives the total and the order's page in a payment reminder", () => {
    const text = composeCustomerMessage("paymentReminder", order({ paymentMethod: "QRIS" }), CONTEXT);
    expect(text).toMatch(/total Rp\s?18\.000/);
    expect(text.endsWith("https://bunnye.vercel.app/pesanan/PO-0016")).toBe(true);
  });

  it("says where it is being taken, and what to have ready in cash", () => {
    const text = composeCustomerMessage("onTheWay", order(), CONTEXT);
    expect(text).toContain("lagi kami antar ke Kampus B (Halimun) · Depan gazebo");
    expect(text).toMatch(/Siapin Rp\s?18\.000/);
  });

  it("leaves the problem for staff to write", () => {
    expect(composeCustomerMessage("delay", order(), CONTEXT).endsWith("ada kendala: ")).toBe(true);
  });

  it("never carries the customer's phone or anything else private", () => {
    for (const template of customerTemplates(order({ paymentMethod: "QRIS" }))) {
      expect(composeCustomerMessage(template, order({ paymentMethod: "QRIS" }), CONTEXT)).not.toContain("1234");
    }
  });
});

describe("needsLocationNotice", () => {
  it("waits for the check to be done", () => {
    expect(needsLocationNotice(lainnya({ awaitingLocationCheck: true }), TODAY)).toBe(false);
  });

  it("flags an accepted or rejected Lainnya customer nobody has told", () => {
    expect(needsLocationNotice(lainnya(), TODAY)).toBe(true);
    expect(needsLocationNotice(rejected(), TODAY)).toBe(true);
  });

  it("stops once they are told", () => {
    expect(needsLocationNotice(lainnya({ locationNotifiedAt: "2026-11-20T07:00:00Z" }), TODAY)).toBe(false);
  });

  it("drops it once the handover is behind us, or for another place", () => {
    expect(needsLocationNotice(lainnya({ serviceDate: "2026-11-19" }), TODAY)).toBe(false);
    expect(needsLocationNotice(lainnya({ status: "DONE" }), TODAY)).toBe(false);
    expect(needsLocationNotice(order(), TODAY)).toBe(false);
  });
});
