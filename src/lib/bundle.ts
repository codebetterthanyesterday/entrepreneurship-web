/**
 * Paket (combo) rules that need no database: how many of a bundle can still be
 * sold, and how a bundle line is told apart from a product line in the cart.
 *
 * A bundle has no stock of its own. It can be sold as long as every product in
 * it can, and ordering one takes each product's portions out of that product's
 * own stock (`createOrder`). So the number of a bundle on offer is decided by
 * whichever of its products runs out first.
 */

/** One product inside a bundle, and how many portions of it the bundle holds. */
export interface BundleComponent {
  productId: string;
  quantity: number;
}

/** A bundle as the customer pages see it. */
export interface PublicBundle {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  /** What the products would cost bought one by one, for the "hemat" figure. */
  normalPrice: number;
  items: {
    productId: string;
    name: string;
    quantity: number;
    imageUrl: string | null;
    categoryName: string | null;
    prepType: "READY_TO_SERVE" | "NEEDS_PREP";
  }[];
}

/**
 * How many whole bundles the given stock can make.
 *
 * `stockOf` answers for each product; a product it does not know (hidden,
 * deleted) counts as zero, so a bundle with a missing product is never on
 * offer. A bundle with no products at all is not on offer either — selling an
 * empty box is a data error, not a free item.
 */
export function bundlesAvailable(
  components: readonly BundleComponent[],
  stockOf: (productId: string) => number,
): number {
  if (components.length === 0) return 0;

  let available = Number.POSITIVE_INFINITY;

  for (const component of components) {
    if (component.quantity <= 0) return 0;
    const stock = Math.max(0, stockOf(component.productId));
    available = Math.min(available, Math.floor(stock / component.quantity));
  }

  return Number.isFinite(available) ? available : 0;
}

/**
 * The products a basket takes out of stock: loose products plus every
 * bundle's contents, added up per product.
 *
 * This is the one place the "how much of each product does this basket use"
 * arithmetic lives, so the cart's caps and the server's checks cannot drift.
 */
export function portionsUsed(
  products: readonly { productId: string; quantity: number }[],
  bundles: readonly { quantity: number; components: readonly BundleComponent[] }[],
): Map<string, number> {
  const used = new Map<string, number>();
  const add = (productId: string, quantity: number) =>
    used.set(productId, (used.get(productId) ?? 0) + quantity);

  for (const line of products) add(line.productId, line.quantity);
  for (const bundle of bundles) {
    for (const component of bundle.components) add(component.productId, component.quantity * bundle.quantity);
  }

  return used;
}

/**
 * The cart stores every line as `{ productId, quantity }` — that shape is what
 * customers already have in their browsers, and changing it would empty their
 * carts. A bundle line uses the same shape with its id under this prefix.
 */
export const BUNDLE_KEY_PREFIX = "paket:";

export function bundleKey(bundleId: string): string {
  return `${BUNDLE_KEY_PREFIX}${bundleId}`;
}

/** The bundle id inside a cart key, or `null` for an ordinary product line. */
export function bundleIdOf(key: string): string | null {
  return key.startsWith(BUNDLE_KEY_PREFIX) ? key.slice(BUNDLE_KEY_PREFIX.length) || null : null;
}

/** How much a bundle saves against buying its products one by one. */
export function bundleSaving(bundle: Pick<PublicBundle, "price" | "normalPrice">): number {
  return Math.max(0, bundle.normalPrice - bundle.price);
}
