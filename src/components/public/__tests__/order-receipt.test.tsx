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
  it("lists the food lines and one total", () => {
    render(<OrderReceipt lines={FOOD} total={36_000} />);
    expect(screen.getByText("Es Kopi Aren")).toBeTruthy();
    const total = screen.getByText("Total").parentElement!;
    expect(within(total).getByText(rp(36_000))).toBeTruthy();
  });
});
