// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrderTicket } from "@/components/public/order-ticket";
import { ToastProvider } from "@/components/ui/use-toast";
import type { TrackedOrder } from "@/types/order-view";

afterEach(cleanup);

const ORDER: TrackedOrder = {
  orderNumber: "PO-0007",
  customerName: "Amanda Larasati",
  pickupSlot: "21.00 - 22.00",
  paymentMethod: "QRIS",
  paymentStatus: "PAID",
  hasPaymentProof: true,
  status: "CONFIRMED",
  notes: null,
  totalAmount: 25000,
  needsPrep: true,
  items: [
    { name: "Milk Tea Bean Curd", quantity: 1, priceAtOrder: 10000, subtotal: 10000 },
    { name: "Chicken Roll", quantity: 1, priceAtOrder: 15000, subtotal: 15000 },
  ],
  photobooth: [],
};

function renderTicket(order: TrackedOrder, numberAs?: "h1" | "p") {
  return render(
    <ToastProvider>
      <OrderTicket order={order} numberAs={numberAs} />
    </ToastProvider>,
  );
}

describe("OrderTicket", () => {
  it("makes the number the page's heading only where it is asked to", () => {
    renderTicket(ORDER, "h1");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Nomor pesanan PO-0007");

    cleanup();
    renderTicket(ORDER);
    // On the tracker the stage's title is the <h1>; a second one here would
    // leave the page with two.
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("says who it is for, when to come, and what it costs", () => {
    renderTicket(ORDER);

    expect(screen.getByText("Amanda Larasati")).toBeTruthy();
    expect(screen.getByText("Slot: 21.00 - 22.00")).toBeTruthy();
    expect(screen.getByText("Milk Tea Bean Curd")).toBeTruthy();
    expect(screen.getByText(/Rp\s?25\.000/)).toBeTruthy();
  });

  it("never calls an unpaid order paid", () => {
    renderTicket({ ...ORDER, paymentMethod: "CASH", paymentStatus: "UNPAID" });

    expect(screen.getByText("Status: Belum dibayar")).toBeTruthy();
    expect(screen.queryByText("Status: Lunas")).toBeNull();
    expect(screen.getByText("Bayar pas ambil")).toBeTruthy();
  });

  it("marks a cancelled order as cancelled, whatever was paid", () => {
    renderTicket({ ...ORDER, status: "CANCELLED" });

    expect(screen.getByText("Status: Dibatalkan")).toBeTruthy();
  });

  it("draws a QR that is described by the number it holds", () => {
    renderTicket(ORDER);

    const qr = screen.getByRole("img", { name: "Kode QR berisi nomor pesanan PO-0007" });
    expect(qr.querySelector("svg")).toBeTruthy();
  });
});
