"use client";

import * as React from "react";
import {
  bundleIdOf,
  bundleKey,
  bundlesAvailable,
  portionsUsed,
  type BundleComponent,
} from "@/lib/bundle";

/*
 * Deliberately keeps its old prefix while the rest of the app is being
 * de-branded. This key is the only handle on a cart that already exists in
 * somebody's browser: renaming it does not migrate those carts, it empties them.
 * Nobody ever sees it, so there is nothing to gain. See `src/lib/brand.ts`.
 */
const STORAGE_KEY = "ngd-cart";

/**
 * What the cart keeps per line — an id and a count, and deliberately nothing
 * else. A paket's line uses the same shape, its id under the `paket:` prefix
 * (`bundleKey`), so carts already saved in customers' browsers keep reading. Prices are never stored: they are read back from the server on every
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

/** The paket fields the cart needs: its price, and what it takes from stock. */
export interface CartBundle {
  id: string;
  name: string;
  price: number;
  items: readonly BundleComponent[];
}

/**
 * One line in the cart. `productId` is the line's key and `product` its name,
 * price and cap — for a paket line too, so everything that only lists lines
 * (receipts, counts, totals) needs no second code path. A paket line also
 * carries `bundle`, for the pages that show what is inside it and for checkout,
 * which sends pakets separately.
 */
export interface CartEntry extends CartLine {
  product: CartProduct;
  subtotal: number;
  bundle?: CartBundle;
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
  /** Lines whose product or paket is still in the catalogue, priced from it. */
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
  /** How many more of a paket the stock still allows, given the cart. */
  remainingBundles: (bundleId: string) => number;
  /** What checkout sends: loose products and pakets, apart. */
  orderLines: () => {
    items: { productId: string; quantity: number }[];
    bundles: { bundleId: string; quantity: number }[];
  };
}

/**
 * Cart state for the customer-facing pages.
 *
 * `products` is the live catalogue. Anything in storage that is no longer in it
 * — deleted, hidden, or sold out of the catalogue entirely — is dropped without
 * a word, because a shopper coming back a day later should just see a cart with
 * the still-orderable things in it, not a list of errors.
 */
/** Shared, so a caller with no pakets does not hand the hook a new array every render. */
const NO_BUNDLES: readonly CartBundle[] = [];

export function useCart(
  products: readonly CartProduct[],
  bundles: readonly CartBundle[] = NO_BUNDLES,
): UseCartResult {
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

  const bundleById = React.useMemo(
    () => new Map(bundles.map((bundle) => [bundle.id, bundle])),
    [bundles],
  );

  /** Whether a stored line still points at something on sale. */
  const isKnown = React.useCallback(
    (key: string) => {
      const bundleId = bundleIdOf(key);
      return bundleId ? bundleById.has(bundleId) : productById.has(key);
    },
    [bundleById, productById],
  );

  // Keep what is on disk in step with what is still sellable. This only syncs
  // an external store — the re-render comes back through the store itself.
  React.useEffect(() => {
    const kept = lines.filter((line) => isKnown(line.productId));
    if (kept.length !== lines.length) writeStorage(kept);
  }, [lines, isKnown]);

  const commit = React.useCallback(
    (next: CartLine[]) => {
      // Every write also drops anything that has left the catalogue.
      writeStorage(next.filter((line) => isKnown(line.productId)));
    },
    [isKnown],
  );

  const quantityOf = React.useCallback(
    (productId: string) => lines.find((line) => line.productId === productId)?.quantity ?? 0,
    [lines],
  );

  /**
   * Portions of each product the cart already takes — loose, and inside every
   * paket in it. A paket and a loose product draw on the same shelf, so both
   * caps below read this one figure.
   */
  const used = React.useMemo(() => {
    const loose: { productId: string; quantity: number }[] = [];
    const inBundles: { quantity: number; components: readonly BundleComponent[] }[] = [];

    for (const line of lines) {
      const bundleId = bundleIdOf(line.productId);
      if (!bundleId) {
        loose.push(line);
        continue;
      }
      const bundle = bundleById.get(bundleId);
      if (bundle) inBundles.push({ quantity: line.quantity, components: bundle.items });
    }

    return portionsUsed(loose, inBundles);
  }, [lines, bundleById]);

  const productLeft = React.useCallback(
    (productId: string) => Math.max(0, (productById.get(productId)?.stock ?? 0) - (used.get(productId) ?? 0)),
    [productById, used],
  );

  const remainingBundles = React.useCallback(
    (bundleId: string) => {
      const bundle = bundleById.get(bundleId);
      return bundle ? bundlesAvailable(bundle.items, productLeft) : 0;
    },
    [bundleById, productLeft],
  );

  const remainingStock = React.useCallback(
    (product: CartProduct) => {
      const bundleId = bundleIdOf(product.id);
      return bundleId ? remainingBundles(bundleId) : productLeft(product.id);
    },
    [productLeft, remainingBundles],
  );

  /** The most a line may hold: what it has, plus what the shelf still allows. */
  const capFor = React.useCallback(
    (key: string) => {
      const bundleId = bundleIdOf(key);
      const left = bundleId ? remainingBundles(bundleId) : productLeft(key);
      return quantityOf(key) + left;
    },
    [productLeft, quantityOf, remainingBundles],
  );

  const addItem = React.useCallback(
    (productId: string, quantity = 1) => {
      if (!isKnown(productId) || quantity <= 0) return;

      const existing = quantityOf(productId);
      const capped = Math.min(existing + quantity, capFor(productId));
      if (capped <= existing) return;

      commit(
        existing === 0
          ? [...lines, { productId, quantity: capped }]
          : lines.map((line) =>
              line.productId === productId ? { ...line, quantity: capped } : line,
            ),
      );
    },
    [capFor, commit, isKnown, lines, quantityOf],
  );

  const updateQuantity = React.useCallback(
    (productId: string, quantity: number) => {
      if (!isKnown(productId)) return;

      if (quantity <= 0) {
        commit(lines.filter((line) => line.productId !== productId));
        return;
      }

      const capped = Math.min(quantity, capFor(productId));
      if (capped <= 0) return;
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
    [capFor, commit, isKnown, lines],
  );

  const removeItem = React.useCallback(
    (productId: string) => commit(lines.filter((line) => line.productId !== productId)),
    [commit, lines],
  );

  const clearCart = React.useCallback(() => commit([]), [commit]);

  const entries = React.useMemo(
    () =>
      lines.flatMap((line): CartEntry[] => {
        const bundleId = bundleIdOf(line.productId);

        if (bundleId) {
          const bundle = bundleById.get(bundleId);
          if (!bundle) return [];

          return [
            {
              ...line,
              // A paket's own "stock" is however many the cart could hold of
              // it: what it has, plus what the shelf still allows.
              product: {
                id: line.productId,
                name: bundle.name,
                price: bundle.price,
                stock: line.quantity + bundlesAvailable(bundle.items, productLeft),
              },
              subtotal: bundle.price * line.quantity,
              bundle,
            },
          ];
        }

        const product = productById.get(line.productId);
        if (!product) return [];

        return [{ ...line, product, subtotal: product.price * line.quantity }];
      }),
    [lines, productById, bundleById, productLeft],
  );

  const orderLines = React.useCallback(
    () => ({
      items: entries
        .filter((entry) => !entry.bundle)
        .map((entry) => ({ productId: entry.productId, quantity: entry.quantity })),
      bundles: entries.flatMap((entry) =>
        entry.bundle ? [{ bundleId: entry.bundle.id, quantity: entry.quantity }] : [],
      ),
    }),
    [entries],
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
    remainingBundles,
    orderLines,
  };
}

export { bundleKey };

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
