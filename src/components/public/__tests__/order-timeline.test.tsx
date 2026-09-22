// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrderTimeline } from "@/components/public/order-timeline";
import { OrderReceipt } from "@/components/public/order-receipt";

afterEach(cleanup);

/**
 * The timeline lost its numbered circles, so the only thing telling anyone which
 * stage an order is on is `aria-current` and the wording. These tests exist so a
 * later restyle cannot quietly take that away — a page that says nothing about
 * where the order is has failed at its one job.
 */
describe("OrderTimeline", () => {
  it("marks exactly one stage as the current step", () => {
    render(<OrderTimeline status="READY" needsPrep />);

    const current = screen.getAllByRole("listitem").filter(
      (item) => item.getAttribute("aria-current") === "step",
    );

    expect(current).toHaveLength(1);
    expect(current[0]!.textContent).toContain("Siap diambil!");
  });

  it("hides the detail of a stage the order has not reached", () => {
    render(<OrderTimeline status="CONFIRMED" needsPrep />);

    // Confirmed with prep still to come leaves three stages ahead — diracik,
    // siap diambil, selesai — and none of them may describe itself as having
    // happened.
    expect(screen.getAllByText("Belum sampai tahap ini")).toHaveLength(3);
    expect(screen.queryByText("Mampir ke booth ya, bawa nomor pesanan")).toBeNull();
  });

  it("leaves the prep stage out when there is nothing to make", () => {
    render(<OrderTimeline status="CONFIRMED" needsPrep={false} />);

    expect(screen.queryByText("Lagi diracik")).toBeNull();
    expect(screen.getByText("Udah dikonfirmasi")).toBeTruthy();
  });

  it("shows the prep stage when something has to be made", () => {
    render(<OrderTimeline status="IN_PROGRESS" needsPrep />);

    expect(screen.getByText("Lagi diracik")).toBeTruthy();
  });

  it("has every stage done once the order is finished", () => {
    render(<OrderTimeline status="DONE" needsPrep />);

    expect(screen.queryByText("Belum sampai tahap ini")).toBeNull();
  });
});

/**
 * The receipt is the surface the cart, the checkout, the confirmation and the
 * tracker all share, so a change to it lands on four screens at once.
 */
describe("OrderReceipt", () => {
  const lines = [
    { key: "a", name: "Es Teh Manis", quantity: 2, subtotal: 6000 },
    { key: "b", name: "Risoles", quantity: 1, subtotal: 8000 },
  ];

  it("keeps the quantity outside the truncated name", () => {
    render(<OrderReceipt lines={lines} total={14000} />);

    // A long name must never hide how many were ordered.
    expect(screen.getByText("2×")).toBeTruthy();
    expect(screen.getByText("Es Teh Manis")).toBeTruthy();
  });

  it("always prints a total, including for an empty bill", () => {
    render(<OrderReceipt lines={[]} total={0} emptyNote="Belum ada apa-apa." />);

    expect(screen.getByText("Belum ada apa-apa.")).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();
  });

  it("formats every figure as rupiah", () => {
    render(<OrderReceipt lines={lines} total={14000} />);

    expect(screen.getByText(/Rp\s?14\.000/)).toBeTruthy();
    expect(screen.getByText(/Rp\s?6\.000/)).toBeTruthy();
  });
});
