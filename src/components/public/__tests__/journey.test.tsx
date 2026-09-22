// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JourneyRail } from "@/components/public/journey";
import { foodKindOf } from "@/components/public/journey-art";
import { flyToCart } from "@/lib/fly-to-cart";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("JourneyRail", () => {
  it("marks exactly the current stop", () => {
    render(<JourneyRail current="cart" />);

    const current = screen
      .getAllByRole("listitem")
      .filter((item) => item.getAttribute("aria-current") === "step");

    expect(current).toHaveLength(1);
    expect(current[0]!.textContent).toBe("Keranjang");
  });

  it("links back to the stops behind, never ahead", () => {
    render(<JourneyRail current="data" />);
    const rail = screen.getByRole("navigation", { name: "Langkah pemesanan" });

    expect(within(rail).getByRole("link", { name: "Menu" }).getAttribute("href")).toBe("/menu");
    expect(within(rail).getByRole("link", { name: "Keranjang" })).toBeTruthy();
    // The current stop and the one after it are not links.
    expect(within(rail).queryByRole("link", { name: "Isi data" })).toBeNull();
    expect(within(rail).queryByRole("link", { name: "Lacak" })).toBeNull();
  });
});

describe("foodKindOf", () => {
  it.each([
    ["Es Kopi Susu Gula Aren", null],
    ["Lemonade Butterfly Pea", null],
    ["Matcha Latte", null],
    ["Spesial Rumah", "Minuman"],
  ])("gives %s (%s) a cup", (name, categoryName) => {
    expect(foodKindOf({ name, categoryName })).toBe("drink");
  });

  it.each([
    ["Risoles Mayo", "Makanan"],
    ["Pisang Goreng", null],
    ["Donat Gula", null],
    // "es" only as a word, so a snack whose name merely contains it stays a snack.
    ["Pastel Keju", null],
  ])("gives %s (%s) a doughnut", (name, categoryName) => {
    expect(foodKindOf({ name, categoryName })).toBe("snack");
  });
});

describe("flyToCart", () => {
  const origin = { left: 10, top: 10, width: 40, height: 40 } as DOMRect;

  it("does nothing when there is no cart on screen to fly to", () => {
    flyToCart(origin);
    expect(document.querySelector(".fly-dot")).toBeNull();
  });

  it("stays still for a reader who asked for less motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
    const target = document.createElement("a");
    target.dataset.navBadge = "cart";
    document.body.append(target);

    flyToCart(origin);

    expect(document.querySelector(".fly-dot")).toBeNull();
  });
});
