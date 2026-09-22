import { describe, expect, it } from "vitest";
import {
  PREORDER_FILTERS,
  matchesPreorderSearch,
  resolvePreorderAction,
  type PreorderActionInput,
} from "@/lib/cashier-preorder";
import { TRANSITIONS } from "@/lib/services/order.service";
import type { CashierPreorder } from "@/types/order-view";

function order(overrides: Partial<PreorderActionInput> = {}): PreorderActionInput {
  return {
    status: "CONFIRMED",
    paymentStatus: "PAID",
    totalAmount: 20_000,
    needsPrep: false,
    ...overrides,
  };
}

describe("resolvePreorderAction — one action per condition", () => {
  it("asks for payment, with the amount in the button, when the order is unpaid", () => {
    const action = resolvePreorderAction(order({ paymentStatus: "UNPAID" }));

    expect(action.kind).toBe("PAY");
    expect(action.label).toContain("Terima pembayaran");
    expect(action.label).toContain("20.000");
  });

  it("sends a paid, confirmed order with something to make to the kitchen", () => {
    const action = resolvePreorderAction(order({ status: "CONFIRMED", needsPrep: true }));

    expect(action).toMatchObject({
      kind: "TRANSITION",
      to: "IN_QUEUE",
      label: "Pelanggan datang, kirim ke dapur",
      variant: "go",
    });
  });

  it("hands over a paid, confirmed order with nothing to make", () => {
    const action = resolvePreorderAction(order({ status: "CONFIRMED", needsPrep: false }));

    expect(action).toMatchObject({ kind: "TRANSITION", to: "DONE", variant: "done" });
  });

  it("hands over an order the kitchen has finished", () => {
    const action = resolvePreorderAction(order({ status: "READY", needsPrep: true }));

    expect(action).toMatchObject({ kind: "TRANSITION", to: "DONE", label: "Serahkan sekarang" });
  });

  it.each(["IN_QUEUE", "IN_PROGRESS"] as const)(
    "blocks an order the kitchen still has (%s)",
    (status) => {
      const action = resolvePreorderAction(order({ status, needsPrep: true }));

      expect(action).toMatchObject({ kind: "BLOCKED", label: "Tunggu dapur selesai dulu" });
    },
  );

  it("blocks an order that is already finished", () => {
    expect(resolvePreorderAction(order({ status: "DONE" }))).toMatchObject({
      kind: "BLOCKED",
      label: "Pesanan ini sudah selesai",
    });
  });

  it("blocks a cancelled order", () => {
    expect(resolvePreorderAction(order({ status: "CANCELLED" }))).toMatchObject({
      kind: "BLOCKED",
      label: "Pesanan ini dibatalkan",
    });
  });

  it("never offers to take payment on a terminal order", () => {
    // markAsPaid refuses both, so a pay button here could only end in an error.
    for (const status of ["CANCELLED", "DONE"] as const) {
      expect(resolvePreorderAction(order({ status, paymentStatus: "UNPAID" })).kind).toBe(
        "BLOCKED",
      );
    }
  });

  it("only ever proposes a transition the cashier is allowed to walk", () => {
    const statuses = ["CONFIRMED", "IN_QUEUE", "IN_PROGRESS", "READY", "DONE", "CANCELLED"] as const;

    for (const status of statuses) {
      for (const needsPrep of [true, false]) {
        const action = resolvePreorderAction(order({ status, needsPrep }));
        if (action.kind !== "TRANSITION") continue;

        expect(TRANSITIONS[status][action.to]).toContain("KASIR");
      }
    }
  });
});

describe("PREORDER_FILTERS", () => {
  it('folds both kitchen statuses into "Di dapur"', () => {
    const kitchen = PREORDER_FILTERS.find((filter) => filter.key === "kitchen");

    expect(kitchen?.statuses).toEqual(["IN_QUEUE", "IN_PROGRESS"]);
  });

  it('keeps "Semua" unfiltered', () => {
    expect(PREORDER_FILTERS[0]!.statuses).toEqual([]);
  });
});

describe("matchesPreorderSearch", () => {
  const preorder = { orderNumber: "PO-0007", customerName: "Salsa" } as CashierPreorder;

  it("matches the order number and the name, ignoring case", () => {
    expect(matchesPreorderSearch(preorder, "po-0007")).toBe(true);
    expect(matchesPreorderSearch(preorder, "SALSA")).toBe(true);
    expect(matchesPreorderSearch(preorder, "0007")).toBe(true);
  });

  it("keeps everything while the box is empty or only spaces", () => {
    expect(matchesPreorderSearch(preorder, "")).toBe(true);
    expect(matchesPreorderSearch(preorder, "   ")).toBe(true);
  });

  it("drops what does not match", () => {
    expect(matchesPreorderSearch(preorder, "Rizky")).toBe(false);
  });
});
