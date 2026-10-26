// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrderReceipt } from "@/components/public/order-receipt";
import { formatRupiah } from "@/lib/utils";

afterEach(cleanup);

/**
 * formatRupiah's output as Testing Library sees page text: it turns the
 * non-breaking space after "Rp" into a plain one before matching.
 */
const rp = (amount: number) => formatRupiah(amount).replace(/\u00a0/g, " ");

const FOOD = [{ key: "kopi", name: "Es Kopi Aren", quantity: 2, subtotal: 36_000 }];

describe("OrderReceipt", () => {
  it("without photobooth charges reads as before: food lines and one total", () => {
    render(<OrderReceipt lines={FOOD} total={36_000} />);
    expect(screen.queryByRole("region", { name: "Photobooth" })).toBeNull();
    expect(screen.getByText("Total")).toBeTruthy();
    const total = screen.getByText("Total").parentElement!;
    expect(within(total).getByText(rp(36_000))).toBeTruthy();
  });

  it("shows paid photobooth charges in their own section, the food subtotal, and the combined total", () => {
    render(
      <OrderReceipt
        lines={FOOD}
        total={36_000}
        photobooth={[{ key: "c1", description: "Cetak 4R ×2 · Buka semua foto HD", amount: 31_000 }]}
      />,
    );

    const section = screen.getByRole("region", { name: "Photobooth" });
    expect(within(section).getByText("Cetak 4R ×2 · Buka semua foto HD")).toBeTruthy();
    expect(within(section).getByText(rp(31_000))).toBeTruthy();
    expect(within(section).getByText("Sudah dibayar di booth photobooth.")).toBeTruthy();

    // Food keeps its own subtotal; the bottom line adds the two.
    const subtotal = screen.getByText("Subtotal makanan").parentElement!;
    expect(within(subtotal).getByText(rp(36_000))).toBeTruthy();
    const total = screen.getByText("Total gabungan").parentElement!;
    expect(within(total).getByText(rp(67_000))).toBeTruthy();
  });
});
