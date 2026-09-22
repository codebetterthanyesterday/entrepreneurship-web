import { requireRole } from "@/lib/session";
import { getAllProducts, getCategories, getProductSalesCounts } from "@/lib/queries/product.query";
import { getSettings } from "@/lib/services/setting.service";
import { MenuManager } from "@/components/admin/menu-manager";
import type { AdminCategory, AdminProduct } from "@/types/admin";
import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Menu & stok"),
};

export default async function AdminMenuPage() {
  await requireRole("ADMIN");

  const [products, categories, settings, salesCounts] = await Promise.all([
    getAllProducts(),
    getCategories(),
    getSettings(),
    getProductSalesCounts(),
  ]);

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
    categoryId: product.categoryId ?? null,
    categoryName: product.category?.name ?? null,
    sold: salesCounts[product.id] ?? 0,
  }));

  const categoryOptions: AdminCategory[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));

  return (
    <MenuManager
      products={items}
      categories={categoryOptions}
      lowStockThreshold={settings.lowStockThreshold}
    />
  );
}
