import { requireRole } from "@/lib/session";
import { getActiveProducts, getCategories } from "@/lib/queries/product.query";
import { getTodayRevenue } from "@/lib/queries/report.query";
import { getSettings } from "@/lib/services/setting.service";
import { PosScreen } from "@/components/kasir/pos-screen";
import { formatRupiah } from "@/lib/utils";
import type { PublicProduct } from "@/types/admin";
import { pageTitle } from "@/lib/brand";

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
  const [products, categories, settings, revenue] = await Promise.all([
    getActiveProducts(),
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
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
            Kasir {user.name}
          </h1>
          <p className="text-sm text-ink-soft">Ketuk menu buat nambah ke bill</p>
        </div>

        <div className="text-right flex-none">
          <div className="text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
            Uang masuk hari ini
          </div>
          <div className="font-[family-name:var(--font-display)] text-xl text-pink-deep">
            {formatRupiah(revenue)}
          </div>
        </div>
      </div>

      <PosScreen
        products={items}
        categories={categories.map((category) => category.name)}
        boothOpen={settings.boothOpen}
        qrisImageUrl={settings.qrisImageUrl ?? null}
      />
    </div>
  );
}
