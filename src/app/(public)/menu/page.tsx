import { getActiveProducts, getCategories } from "@/lib/queries/product.query";
import { getSettings } from "@/lib/services/setting.service";
import { Catalog } from "@/components/public/catalog";
import type { PublicProduct } from "@/types/admin";
import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Menu"),
};

// Stock and the preorder switch change during the event, and this page reads
// them straight from the database rather than through `fetch`, so Next has no
// signal that it is dynamic and would otherwise prerender it at build time —
// freezing the catalogue at whatever the stock was when the build ran.
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const [products, categories, settings] = await Promise.all([
    getActiveProducts(),
    getCategories(),
    getSettings(),
  ]);

  // Plain values only — Prisma rows carry Temporal instants that cannot cross
  // the server/client boundary.
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

  // No `PageShell` here: the catalogue brings its own full-bleed bands, the same
  // way the profile page does, so its dark heading can reach the screen edge.
  return (
    <Catalog
      products={items}
      categories={categories.map((category) => category.name)}
      preorderOpen={settings.preorderOpen}
    />
  );
}
