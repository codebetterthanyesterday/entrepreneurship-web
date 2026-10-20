// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CashierPreorder } from "@/types/order-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/actions/kasir.actions", () => ({
  markAsPaidAction: vi.fn(async () => ({ ok: true, data: {} })),
  transitionOrderAction: vi.fn(async () => ({ ok: true, data: {} })),
}));

const { PreorderScreen } = await import("@/components/kasir/preorder-screen");
const { ToastProvider } = await import("@/components/ui/use-toast");
const { formatRupiah } = await import("@/lib/utils");

afterEach(cleanup);

/**
 * formatRupiah's output as Testing Library sees page text: it turns the
 * non-breaking space after "Rp" into a plain one before matching.
 */
const rp = (amount: number) => formatRupiah(amount).replace(/\u00a0/g, " ");

function preorder(overrides: Partial<CashierPreorder> = {}): CashierPreorder {
  return {
    id: "order-1",
    orderNumber: "PO-0042",
    customerName: "Nadia Prameswari",
    pickupSlot: "09.00 - 10.00",
    paymentMethod: "CASH",
    paymentStatus: "UNPAID",
    paymentProofUrl: null,
    status: "CONFIRMED",
    notes: null,
    totalAmount: 36_000,
    itemCount: 2,
    needsPrep: false,
    items: [
      { name: "Es Kopi Aren", quantity: 2, priceAtOrder: 18_000, subtotal: 36_000, needsPrep: false },
    ],
    photobooth: [],
    ...overrides,
  };
}

function open(order: CashierPreorder) {
  render(
    <ToastProvider>
      <PreorderScreen preorders={[order]} qrisImageUrl={null} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByText(order.customerName));
}

describe("PreorderScreen: photobooth charges (BPB-098)", () => {
  it("shows them as already paid at the booth, apart from the food the cashier collects", () => {
    open(
      preorder({
        photobooth: [{ key: "c1", description: "Cetak 4R ×2", amount: 16_000 }],
      }),
    );

    const section = screen.getByRole("region", { name: /Photobooth/ });
    expect(within(section).getByText("lunas di booth")).toBeTruthy();
    expect(within(section).getByText("Cetak 4R ×2")).toBeTruthy();
    expect(within(section).getByText(/Jangan ditagih lagi/)).toBeTruthy();
    expect(within(section).getByText(rp(52_000))).toBeTruthy();

    // What the cashier collects is still the food total.
    const total = screen.getAllByText("Total").at(0)!.parentElement!;
    expect(within(total).getByText(rp(36_000))).toBeTruthy();
  });

  it("says nothing about the photobooth when there are no charges", () => {
    open(preorder());
    expect(screen.queryByRole("region", { name: /Photobooth/ })).toBeNull();
  });
});
