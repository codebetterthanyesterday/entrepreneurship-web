// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useCart, type CartProduct } from "@/hooks/use-cart";

const STORAGE_KEY = "ngd-cart";

const kopi: CartProduct = { id: "kopi", name: "Es Kopi Susu", price: 18_000, stock: 10 };
const croffle: CartProduct = { id: "croffle", name: "Croffle Butter", price: 20_000, stock: 2 };
const CATALOGUE = [kopi, croffle];

function stored(): unknown {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("useCart — basics", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useCart(CATALOGUE));

    expect(result.current.entries).toEqual([]);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.total).toBe(0);
  });

  it("adds an item and prices it from the catalogue", () => {
    const { result } = renderHook(() => useCart(CATALOGUE));

    act(() => result.current.addItem("kopi", 2));

    expect(result.current.itemCount).toBe(2);
    expect(result.current.total).toBe(36_000);
    expect(result.current.entries[0]!.subtotal).toBe(36_000);
    expect(result.current.entries[0]!.product.name).toBe("Es Kopi Susu");
  });

  it("accumulates repeat adds of the same product into one line", () => {
    const { result } = renderHook(() => useCart(CATALOGUE));

    act(() => result.current.addItem("kopi", 1));
    act(() => result.current.addItem("kopi", 2));

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]!.quantity).toBe(3);
  });

  it("removes, updates and clears", () => {
    const { result } = renderHook(() => useCart(CATALOGUE));

    act(() => result.current.addItem("kopi", 2));
    act(() => result.current.addItem("croffle", 1));
    expect(result.current.itemCount).toBe(3);

    act(() => result.current.updateQuantity("kopi", 5));
    expect(result.current.quantityOf("kopi")).toBe(5);

    act(() => result.current.removeItem("croffle"));
    expect(result.current.entries).toHaveLength(1);

    act(() => result.current.clearCart());
    expect(result.current.entries).toEqual([]);
    expect(stored()).toEqual([]);
  });

  it("treats a zero or negative quantity as a removal", () => {
    const { result } = renderHook(() => useCart(CATALOGUE));

    act(() => result.current.addItem("kopi", 2));
    act(() => result.current.updateQuantity("kopi", 0));

    expect(result.current.entries).toEqual([]);
  });
});

describe("useCart — persistence", () => {
  it("survives a remount, which is what a page refresh is", () => {
    const first = renderHook(() => useCart(CATALOGUE));
    act(() => first.result.current.addItem("kopi", 3));
    first.unmount();

    const second = renderHook(() => useCart(CATALOGUE));

    expect(second.result.current.itemCount).toBe(3);
    expect(second.result.current.total).toBe(54_000);
  });

  it("stores only the id and the count, never the price", () => {
    const { result } = renderHook(() => useCart(CATALOGUE));

    act(() => result.current.addItem("kopi", 2));

    expect(stored()).toEqual([{ productId: "kopi", quantity: 2 }]);
    expect(JSON.stringify(stored())).not.toContain("18000");
  });

  it("reprices from the catalogue, ignoring a tampered stored price", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ productId: "kopi", quantity: 1, price: 1 }]),
    );

    const { result } = renderHook(() => useCart(CATALOGUE));

    expect(result.current.total).toBe(18_000);
  });
});

describe("useCart — stale and malformed storage", () => {
  it("silently drops a product that has left the catalogue", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { productId: "kopi", quantity: 1 },
        { productId: "sudah-dihapus", quantity: 4 },
      ]),
    );

    const { result } = renderHook(() => useCart(CATALOGUE));

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.itemCount).toBe(1);
    expect(stored()).toEqual([{ productId: "kopi", quantity: 1 }]);
  });

  it("drops a product that leaves the catalogue while the page is open", () => {
    const { result, rerender } = renderHook(({ catalogue }) => useCart(catalogue), {
      initialProps: { catalogue: CATALOGUE },
    });

    act(() => result.current.addItem("croffle", 1));
    expect(result.current.itemCount).toBe(1);

    // The admin hides the croffle; the catalogue re-renders without it.
    rerender({ catalogue: [kopi] });

    expect(result.current.entries).toEqual([]);
    expect(stored()).toEqual([]);
  });

  it("survives malformed JSON", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");

    const { result } = renderHook(() => useCart(CATALOGUE));

    expect(result.current.entries).toEqual([]);
  });

  it("skips entries with a bad shape", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { productId: "kopi", quantity: "dua" },
        { productId: "", quantity: 1 },
        { productId: "croffle", quantity: -1 },
        { productId: "croffle", quantity: 1.5 },
        null,
        { productId: "kopi", quantity: 1 },
      ]),
    );

    const { result } = renderHook(() => useCart(CATALOGUE));

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]!.quantity).toBe(1);
  });
});

describe("useCart — stock", () => {
  it("reports stock net of what is already in the cart", () => {
    const { result } = renderHook(() => useCart(CATALOGUE));

    expect(result.current.remainingStock(croffle)).toBe(2);

    act(() => result.current.addItem("croffle", 1));

    expect(result.current.remainingStock(croffle)).toBe(1);
  });

  it("caps an add at the available stock", () => {
    const { result } = renderHook(() => useCart(CATALOGUE));

    act(() => result.current.addItem("croffle", 99));

    expect(result.current.quantityOf("croffle")).toBe(2);
    expect(result.current.remainingStock(croffle)).toBe(0);
  });

  it("caps repeated adds that would together exceed stock", () => {
    const { result } = renderHook(() => useCart(CATALOGUE));

    act(() => result.current.addItem("croffle", 2));
    act(() => result.current.addItem("croffle", 2));

    expect(result.current.quantityOf("croffle")).toBe(2);
  });

  it("caps an update at the available stock", () => {
    const { result } = renderHook(() => useCart(CATALOGUE));

    act(() => result.current.updateQuantity("croffle", 50));

    expect(result.current.quantityOf("croffle")).toBe(2);
  });

  it("never reports negative remaining stock", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ productId: "croffle", quantity: 99 }]),
    );

    const { result } = renderHook(() => useCart(CATALOGUE));

    expect(result.current.remainingStock(croffle)).toBe(0);
  });
});
