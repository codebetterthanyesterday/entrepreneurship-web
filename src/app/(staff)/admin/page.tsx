import { requireRole } from "@/lib/session";
import {
  getChannelBreakdown,
  getHourlySales,
  getOrderPipeline,
  getSalesSummary,
  getTopProducts,
} from "@/lib/queries/report.query";
import { getLowStockProducts } from "@/lib/queries/product.query";
import { getSettings } from "@/lib/services/setting.service";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { ChannelSplitCard } from "@/components/admin/channel-split-card";
import { DashboardStats } from "@/components/admin/dashboard-stats";
import { HourlySalesCard } from "@/components/admin/hourly-sales-card";
import { LowStockAlert } from "@/components/admin/low-stock-alert";
import { PipelineCard } from "@/components/admin/pipeline-card";
import { TopProductsCard } from "@/components/admin/top-products-card";
import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Ringkasan"),
};

// Every figure here changes as the booth trades, and none of them is read
// through `fetch`, so Next would otherwise prerender this at build time.
export const dynamic = "force-dynamic";

/** The guide's target for the dashboard: never more than half a minute stale. */
const REFRESH_INTERVAL_MS = 30_000;

export default async function AdminDashboardPage() {
  const user = await requireRole("ADMIN");

  const settings = await getSettings();

  const [summary, channels, topProducts, hourly, pipeline, lowStock] = await Promise.all([
    getSalesSummary(),
    getChannelBreakdown(),
    getTopProducts(5),
    getHourlySales(),
    getOrderPipeline(),
    getLowStockProducts(settings.lowStockThreshold),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh intervalMs={REFRESH_INTERVAL_MS} />

      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
          Ringkasan {user.name}
        </h1>
        <p className="text-sm text-ink-soft">Angkanya kebarui sendiri tiap setengah menit</p>
      </div>

      <DashboardStats summary={summary} channels={channels} />

      <LowStockAlert
        items={lowStock.map((product) => ({
          id: product.id,
          name: product.name,
          stock: product.stock,
        }))}
      />

      {/* Two columns from the desktop breakpoint up; one on phone and tablet. */}
      <div className="grid desktop:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-5">
          <ChannelSplitCard channels={channels} />
          <HourlySalesCard hours={hourly} />
        </div>

        <div className="flex flex-col gap-5">
          <TopProductsCard products={topProducts} />
          <PipelineCard pipeline={pipeline} />
        </div>
      </div>
    </div>
  );
}
