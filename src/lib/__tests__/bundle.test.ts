import { describe, expect, it } from "vitest";
import {
  bundleIdOf,
  bundleKey,
  bundleSaving,
  bundlesAvailable,
  portionsUsed,
} from "@/lib/bundle";

const stock = (table: Record<string, number>) => (id: string) => table[id] ?? 0;

describe("bundlesAvailable", () => {
  it("is decided by whichever product runs out first", () => {
    const components = [
      { productId: "roll", quantity: 1 },
      { productId: "tea", quantity: 2 },
    ];

    expect(bundlesAvailable(components, stock({ roll: 10, tea: 7 }))).toBe(3);
  });

  it("is zero when a product is unknown, hidden or out", () => {
    expect(bundlesAvailable([{ productId: "roll", quantity: 1 }], stock({}))).toBe(0);
    expect(bundlesAvailable([{ productId: "roll", quantity: 1 }], stock({ roll: -2 }))).toBe(0);
  });

  it("never offers an empty paket", () => {
    expect(bundlesAvailable([], stock({}))).toBe(0);
  });
});

describe("portionsUsed", () => {
  it("adds loose products and every paket's contents per product", () => {
    const used = portionsUsed(
      [{ productId: "roll", quantity: 1 }],
      [
        {
          quantity: 2,
          components: [
            { productId: "roll", quantity: 1 },
            { productId: "tea", quantity: 1 },
          ],
        },
      ],
    );

    expect(Object.fromEntries(used)).toEqual({ roll: 3, tea: 2 });
  });
});

describe("cart keys", () => {
  it("round-trips a paket id and leaves a product id alone", () => {
    expect(bundleIdOf(bundleKey("abc"))).toBe("abc");
    expect(bundleIdOf("abc")).toBeNull();
    expect(bundleIdOf(bundleKey(""))).toBeNull();
  });
});

describe("bundleSaving", () => {
  it("is never negative, even for a paket priced above its parts", () => {
    expect(bundleSaving({ price: 22_000, normalPrice: 25_000 })).toBe(3_000);
    expect(bundleSaving({ price: 30_000, normalPrice: 25_000 })).toBe(0);
  });
});
