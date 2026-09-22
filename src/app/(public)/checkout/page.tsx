import { getActiveProducts } from "@/lib/queries/product.query";
import { getSelectablePickupSlots } from "@/lib/queries/slot.query";
import { getSettings } from "@/lib/services/setting.service";
import { CheckoutForm } from "@/components/public/checkout-form";
import type { PublicProduct } from "@/types/admin";
import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Dikit lagi selesai"),
};

// Slot availability and the preorder switch change minute to minute, and none
// of it is read through `fetch`, so without this Next would prerender the page
// at build time and serve stale slots.
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [products, slots, settings] = await Promise.all([
    getActiveProducts(),
    getSelectablePickupSlots(),
    getSettings(),
  ]);

  const items: PublicProduct[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description ?? null,
    price: product.price,
    stock: product.stock,
    prepType: product.prepType,
    imageUrl: product.imageUrl ?? null,
    categoryName: product.category?.name ?? null,
  }));

  // No `PageShell`: the checkout brings its own full-bleed bands.
  return <CheckoutForm products={items} slots={slots} preorderOpen={settings.preorderOpen} />;
}
