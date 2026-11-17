import { requireRole } from "@/lib/session";
import { getActiveProducts, getCategories } from "@/lib/queries/product.query";
import { getActiveBundles } from "@/lib/queries/bundle.query";
import { getTodayRevenue } from "@/lib/queries/report.query";
import { getSettings } from "@/lib/services/setting.service";
import { PosScreen } from "@/components/kasir/pos-screen";
import { formatRupiah } from "@/lib/utils";
import type { PublicProduct } from "@/types/admin";
import { pageTitle } from "@/lib/brand";
import { PageHead } from "@/components/staff/page-head";

export const metadata = {
  title: pageTitle("Kasir"),
};

// Stock, the booth switch and today's takings all change during the event, and
// none of them is read through `fetch`, so Next would otherwise prerender this
// at build time.
export const dynamic = "force-dynamic";

export default async function CashierPage() {
  const user = await requireRole("KASIR", "ADMIN");

  // The preorder count that used to be read here moved to the staff layout with
  // the tabs that showed it, so it is fetched once for the whole area rather
  // than again on each of its screens.
  const [products, bundles, categories, settings, revenue] = await Promise.all([
    getActiveProducts(),
    getActiveBundles(),
    getCategories(),
    getSettings(),
    getTodayRevenue(),
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

  return (
    <div className="flex flex-col">
      <PageHead
        tag="Counter station"
        title={`Kasir ${user.name}`}
        lede="Ketuk menu buat nambah ke bill"
        actions={
          <div className="s-slab px-3 py-2 text-right">
            <div className="s-eyebrow">Uang masuk hari ini</div>
            <div className="s-total text-[20px] tabular-nums">{formatRupiah(revenue)}</div>
          </div>
        }
      />

      <PosScreen
        products={items}
        bundles={bundles}
        categories={categories.map((category) => category.name)}
        boothOpen={settings.boothOpen}
        qrisImageUrl={settings.qrisImageUrl ?? null}
      />
    </div>
  );
}
