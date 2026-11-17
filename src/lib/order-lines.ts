import type { OrderWithItems } from "@/lib/services/order.service";

/** One line of a bill: a loose product, or a paket with what is in it. */
export interface PricedLine {
  name: string;
  quantity: number;
  priceAtOrder: number;
  subtotal: number;
  /** For a paket: its contents per paket, e.g. "1× Chicken Roll, 1× Milk Tea". */
  contents: string | null;
  /** Whether anything on this line has to be made to order. */
  needsPrep: boolean;
}

/**
 * The lines of an order as a bill shows them.
 *
 * A paket's contents are stored as order lines priced at zero (so stock,
 * the kitchen and cancellation treat them like any product). A bill must not
 * show them as "1× Chicken Roll Rp0", so they are folded back under the paket
 * that carried them: one priced line per paket, its contents spelled out
 * beneath, and only the loose products as lines of their own.
 *
 * Loose products come first, in the order they were rung up, then pakets.
 */
export function pricedLines(order: Pick<OrderWithItems, "items" | "bundles">): PricedLine[] {
  const loose = order.items
    .filter((item) => !item.orderBundleId)
    .map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
      priceAtOrder: item.priceAtOrder,
      subtotal: item.subtotal,
      contents: null,
      needsPrep: item.product.prepType === "NEEDS_PREP",
    }));

  const bundles = order.bundles.map((bundle) => {
    const contents = order.items.filter((item) => item.orderBundleId === bundle.id);
    const perBundle = (quantity: number) =>
      bundle.quantity > 0 ? Math.round(quantity / bundle.quantity) : quantity;

    return {
      name: bundle.name,
      quantity: bundle.quantity,
      priceAtOrder: bundle.priceAtOrder,
      subtotal: bundle.subtotal,
      contents:
        contents.length > 0
          ? contents.map((item) => `${perBundle(item.quantity)}× ${item.product.name}`).join(", ")
          : null,
      needsPrep: contents.some((item) => item.product.prepType === "NEEDS_PREP"),
    };
  });

  return [...loose, ...bundles];
}

/**
 * The name a kitchen ticket shows for one order line: the product, and for a
 * paket's content the paket it belongs to, so two "Chicken Roll" lines on one
 * ticket read as one loose and one in a combo rather than as a duplicate.
 */
export function kitchenLineName(
  item: OrderWithItems["items"][number],
  bundles: OrderWithItems["bundles"],
): string {
  if (!item.orderBundleId) return item.product.name;
  const bundle = bundles.find((candidate) => candidate.id === item.orderBundleId);
  return bundle ? `${item.product.name} · ${bundle.name}` : item.product.name;
}
