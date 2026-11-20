// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComboCard } from "@/components/public/combo-card";
import { BundleDetailSheet } from "@/components/public/bundle-detail-sheet";
import type { PublicBundle } from "@/lib/bundle";

afterEach(cleanup);

const BUNDLE: PublicBundle = {
  id: "b1",
  name: "Little Power Combo",
  description: null,
  price: 32_000,
  imageUrl: null,
  normalPrice: 38_000,
  items: [
    { productId: "p1", name: "Croffle", quantity: 1, imageUrl: null, categoryName: null, prepType: "NEEDS_PREP" },
    { productId: "p2", name: "Es Kopi", quantity: 1, imageUrl: null, categoryName: null, prepType: "READY_TO_SERVE" },
  ],
};

describe("ComboCard", () => {
  it("opens the paket on a tap anywhere but the claim button, which alone adds it", () => {
    const onOpen = vi.fn();
    const onClaim = vi.fn();
    render(
      <ComboCard bundle={BUNDLE} index={0} remaining={5} inCart={0} preorderOpen onClaim={onClaim} onOpen={onOpen} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Little Power Combo" }));
    expect(onOpen).toHaveBeenCalledWith(BUNDLE);
    expect(onClaim).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Masukin Little Power Combo ke keranjang" }));
    expect(onClaim).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("keeps its title a heading", () => {
    render(<ComboCard bundle={BUNDLE} index={0} remaining={5} inCart={0} preorderOpen onClaim={() => {}} onOpen={() => {}} />);
    expect(screen.getByRole("heading", { name: "Little Power Combo" })).toBeTruthy();
  });
});

describe("BundleDetailSheet", () => {
  it("lists what is in the paket and adds as many as the stock allows", () => {
    const onAdd = vi.fn();
    render(<BundleDetailSheet bundle={BUNDLE} remaining={2} preorderOpen onClose={() => {}} onAdd={onAdd} />);

    expect(screen.getByText("Croffle")).toBeTruthy();
    expect(screen.getByText("Es Kopi")).toBeTruthy();

    const more = screen.getByRole("button", { name: "Tambah" });
    fireEvent.click(more);
    fireEvent.click(more);
    expect((more as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Masukin keranjang/ }));
    expect(onAdd).toHaveBeenCalledWith("b1", 2, expect.anything());
  });

  it("offers nothing to add while preorder is closed", () => {
    render(<BundleDetailSheet bundle={BUNDLE} remaining={5} preorderOpen={false} onClose={() => {}} onAdd={() => {}} />);
    expect(screen.queryByRole("button", { name: /Masukin keranjang/ })).toBeNull();
    expect(screen.getByText("Preorder lagi ditutup")).toBeTruthy();
  });
});
