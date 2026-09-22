import { getActiveProducts } from "@/lib/queries/product.query";
import { getSettings } from "@/lib/services/setting.service";
import { CartView } from "@/components/public/cart-view";
import type { PublicProduct } from "@/types/admin";
import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Keranjang kamu"),
};

// Prices, stock and the preorder switch are read straight from the database
// rather than through `fetch`, so Next would otherwise prerender this page at
// build time and serve a frozen catalogue.
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [products, settings] = await Promise.all([getActiveProducts(), getSettings()]);

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

  // No `PageShell`: the cart brings its own full-bleed bands, so its dark heading
  // can reach the screen edge like the profile and the catalogue.
  return <CartView products={items} preorderOpen={settings.preorderOpen} />;
}
