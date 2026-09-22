"use client";

import * as React from "react";

/*
 * Deliberately keeps its old prefix while the rest of the app is being
 * de-branded. This key is the only handle on a cart that already exists in
 * somebody's browser: renaming it does not migrate those carts, it empties them.
 * Nobody ever sees it, so there is nothing to gain. See `src/lib/brand.ts`.
 */
const STORAGE_KEY = "ngd-cart";

/**
 * What the cart keeps per line — an id and a count, and deliberately nothing
 * else. Prices are never stored: they are read back from the server on every
 * render and recomputed inside `createOrder`, so a hand-edited localStorage
 * entry cannot change what an order costs.
 */
export interface CartLine {
  productId: string;
  quantity: number;
}

/** The product fields the cart needs in order to price and cap itself. */
export interface CartProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export interface CartEntry extends CartLine {
  product: CartProduct;
  subtotal: number;
}

// ---------------------------------------------------------------------------
// localStorage as an external store
//
// The cart lives outside React, so it is read through useSyncExternalStore
// rather than copied into state by an effect. That keeps the server render and
// the first client render in agreement, and makes a cart edited in one tab show
// up in the others.
// ---------------------------------------------------------------------------

const EMPTY: CartLine[] = [];

const listeners = new Set<() => void>();

/** Cached parse, so getSnapshot returns a stable reference while the raw text is unchanged. */
let cachedRaw: string | null = null;
let cachedLines: CartLine[] = EMPTY;

function parseLines(raw: string | null): CartLine[] {
  if (!raw) return EMPTY;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;

    const lines = parsed.flatMap((line): CartLine[] => {
      if (typeof line !== "object" || line === null) return [];
      const { productId, quantity } = line as Partial<CartLine>;

      if (typeof productId !== "string" || productId === "") return [];
      if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) return [];

      return [{ productId, quantity }];
    });

    return lines.length > 0 ? lines : EMPTY;
  } catch {
    // Half-written or hand-edited JSON — an empty cart is always a safe answer.
    return EMPTY;
  }
}

function getSnapshot(): CartLine[] {
  let raw: string | null = null;

  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // A browser set to block site data. Behave like an empty cart.
    return EMPTY;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedLines = parseLines(raw);
  }

  return cachedLines;
}

/** There is no localStorage on the server, so the cart starts empty there. */
function getServerSnapshot(): CartLine[] {
  return EMPTY;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // `storage` fires in the *other* tabs, which is exactly the cross-tab case.
  window.addEventListener("storage", onChange);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function writeStorage(lines: CartLine[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Storage being unavailable must not break checkout; the cart simply will
    // not survive a refresh.
  }

  for (const listener of listeners) listener();
}

export interface UseCartResult {
  /** Lines whose product is still in the catalogue, priced from `products`. */
  entries: CartEntry[];
  /** False until the browser's cart has been read; the server render has none. */
  isReady: boolean;
  itemCount: number;
  total: number;
  addItem: (productId: string, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  quantityOf: (productId: string) => number;
  /** Stock left once what is already in the cart is taken off the shelf. */
  remainingStock: (product: CartProduct) => number;
}

/**
 * Cart state for the customer-facing pages.
 *
 * `products` is the live catalogue. Anything in storage that is no longer in it
 * — deleted, hidden, or sold out of the catalogue entirely — is dropped without
 * a word, because a shopper coming back a day later should just see a cart with
 * the still-orderable things in it, not a list of errors.
 */
export function useCart(products: readonly CartProduct[]): UseCartResult {
  const lines = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isReady = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const productById = React.useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  // Keep what is on disk in step with what is still sellable. This only syncs
  // an external store — the re-render comes back through the store itself.
  React.useEffect(() => {
    const kept = lines.filter((line) => productById.has(line.productId));
    if (kept.length !== lines.length) writeStorage(kept);
  }, [lines, productById]);

  const commit = React.useCallback(
    (next: CartLine[]) => {
      // Every write also drops anything that has left the catalogue.
      writeStorage(next.filter((line) => productById.has(line.productId)));
    },
    [productById],
  );

  const quantityOf = React.useCallback(
    (productId: string) => lines.find((line) => line.productId === productId)?.quantity ?? 0,
    [lines],
  );

  const remainingStock = React.useCallback(
    (product: CartProduct) => Math.max(0, product.stock - quantityOf(product.id)),
    [quantityOf],
  );

  const addItem = React.useCallback(
    (productId: string, quantity = 1) => {
      const product = productById.get(productId);
      if (!product || quantity <= 0) return;

      const existing = lines.find((line) => line.productId === productId)?.quantity ?? 0;
      const capped = Math.min(existing + quantity, product.stock);
      if (capped === existing) return;

      commit(
        existing === 0
          ? [...lines, { productId, quantity: capped }]
          : lines.map((line) =>
              line.productId === productId ? { ...line, quantity: capped } : line,
            ),
      );
    },
    [commit, lines, productById],
  );

  const updateQuantity = React.useCallback(
    (productId: string, quantity: number) => {
      const product = productById.get(productId);
      if (!product) return;

      if (quantity <= 0) {
        commit(lines.filter((line) => line.productId !== productId));
        return;
      }

      const capped = Math.min(quantity, product.stock);
      const exists = lines.some((line) => line.productId === productId);

      // Upsert rather than no-op: a caller asking for a quantity of a product
      // that is not in the cart yet means "make it this many", and silently
      // doing nothing would be the harder bug to spot.
      commit(
        exists
          ? lines.map((line) =>
              line.productId === productId ? { ...line, quantity: capped } : line,
            )
          : [...lines, { productId, quantity: capped }],
      );
    },
    [commit, lines, productById],
  );

  const removeItem = React.useCallback(
    (productId: string) => commit(lines.filter((line) => line.productId !== productId)),
    [commit, lines],
  );

  const clearCart = React.useCallback(() => commit([]), [commit]);

  const entries = React.useMemo(
    () =>
      lines.flatMap((line): CartEntry[] => {
        const product = productById.get(line.productId);
        if (!product) return [];

        return [{ ...line, product, subtotal: product.price * line.quantity }];
      }),
    [lines, productById],
  );

  const itemCount = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const total = entries.reduce((sum, entry) => sum + entry.subtotal, 0);

  return {
    entries,
    isReady,
    itemCount,
    total,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    quantityOf,
    remainingStock,
  };
}

/**
 * Just how many things are in the cart, for the badge in the navigation.
 *
 * It reads the same external store as `useCart`, so the badge moves the instant
 * a product is added and stays in step across tabs — but it does not take the
 * catalogue, which is the point: the navigation lives in a layout that has no
 * product query of its own, and asking for one would put a database round-trip
 * on every public page just to draw a number.
 *
 * The trade-off is that a line whose product has since left the catalogue is
 * still counted here, while `useCart` drops it. That corrects itself as soon as
 * any cart-aware page renders, because `useCart` prunes storage on mount.
 */
export function useCartCount(): number {
  const lines = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
