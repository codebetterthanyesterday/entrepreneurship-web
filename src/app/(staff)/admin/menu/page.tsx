import { requireRole } from "@/lib/session";
import { findProductImages } from "@/lib/queries/product-image.query";
import { getAllProducts, getCategories, getProductSalesCounts } from "@/lib/queries/product.query";
import { getSettings } from "@/lib/services/setting.service";
import { MenuManager } from "@/components/admin/menu-manager";
import { BundleManager, type AdminBundle } from "@/components/admin/bundle-manager";
import { getAllBundles } from "@/lib/queries/bundle.query";
import { getBundleSalesCounts } from "@/lib/queries/product.query";
import type { AdminCategory, AdminProduct } from "@/types/admin";
import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Menu & stok"),
};

export default async function AdminMenuPage() {
  await requireRole("ADMIN");

  const [products, categories, settings, salesCounts, bundles, bundleSales] = await Promise.all([
    getAllProducts(),
    getCategories(),
    getSettings(),
    getProductSalesCounts(),
    getAllBundles(),
    getBundleSalesCounts(),
  ]);

  const photos = await findProductImages(products.map((product) => product.id));

  // Map to plain values — Prisma rows carry Temporal instants that cannot cross
  // the server/client boundary.
  const items: AdminProduct[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    stock: product.stock,
    prepType: product.prepType,
    isActive: product.isActive,
    imageUrl: product.imageUrl ?? null,
    images: photos.get(product.id) ?? [],
    categoryId: product.categoryId ?? null,
    categoryName: product.category?.name ?? null,
    sold: salesCounts[product.id] ?? 0,
  }));

  const categoryOptions: AdminCategory[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));

  const bundleItems: AdminBundle[] = bundles.map((bundle) => ({
    id: bundle.id,
    name: bundle.name,
    description: bundle.description ?? null,
    price: bundle.price,
    imageUrl: bundle.imageUrl ?? null,
    isActive: bundle.isActive,
    sortOrder: bundle.sortOrder,
    sold: bundleSales[bundle.id] ?? 0,
    items: bundle.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
  }));

  return (
    <>
      <MenuManager
        products={items}
        categories={categoryOptions}
        lowStockThreshold={settings.lowStockThreshold}
      />
      <BundleManager bundles={bundleItems} products={items} />
    </>
  );
}
