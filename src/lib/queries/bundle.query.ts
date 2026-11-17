import { prisma as db } from "@/lib/prisma";
import type { PublicBundle } from "@/lib/bundle";

/**
 * The bundles the customer pages offer: active ones whose every product is
 * itself still on sale, in the admin's order.
 *
 * A bundle holding a hidden product is left out rather than shown as sold out.
 * Hiding a product is the admin saying "this is not on the menu today", and a
 * combo built around it is not on the menu either. Sold-out stock is different:
 * the bundle stays listed and the page works out that none can be made.
 */
export async function getActiveBundles(): Promise<PublicBundle[]> {
  const bundles = await db.orm.public.Bundle.where({ isActive: true })
    .include("items", (item) => item.include("product", (product) => product.include("category")))
    .orderBy([(bundle) => bundle.sortOrder.asc(), (bundle) => bundle.name.asc()])
    .all();

  return bundles.flatMap((bundle): PublicBundle[] => {
    // The relation is required, but a nested include is typed as optional.
    const items = bundle.items.flatMap((item) => (item.product ? [{ ...item, product: item.product }] : []));

    if (items.length === 0 || items.length !== bundle.items.length) return [];
    if (!items.every((item) => item.product.isActive)) return [];

    return [
      {
        id: bundle.id,
        name: bundle.name,
        description: bundle.description ?? null,
        price: bundle.price,
        imageUrl: bundle.imageUrl ?? null,
        normalPrice: items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
        items: items
          .sort((a, b) => a.product.name.localeCompare(b.product.name))
          .map((item) => ({
            productId: item.productId,
            name: item.product.name,
            quantity: item.quantity,
            imageUrl: item.product.imageUrl ?? null,
            categoryName: item.product.category?.name ?? null,
            prepType: item.product.prepType,
          })),
      },
    ];
  });
}

/** Every bundle, hidden ones included, for the admin's menu page. */
export async function getAllBundles() {
  return await db.orm.public.Bundle.include("items", (item) => item.include("product"))
    .orderBy([(bundle) => bundle.sortOrder.asc(), (bundle) => bundle.name.asc()])
    .all();
}
