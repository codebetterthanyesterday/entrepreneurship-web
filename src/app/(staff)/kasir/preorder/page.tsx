import { requireRole } from "@/lib/session";
import { findPreordersForCashier, toCashierPreorder } from "@/lib/queries/order.query";
import { getSettings } from "@/lib/services/setting.service";
import { getSiteIdentity } from "@/lib/queries/site.query";
import { PreorderScreen } from "@/components/kasir/preorder-screen";
import { getBookableSchedule } from "@/lib/queries/schedule.query";
import { pageTitle } from "@/lib/brand";
import { PageHead } from "@/components/staff/page-head";

export const metadata = {
  title: pageTitle("Preorder"),
};

// Preorders arrive and the kitchen moves them while the event is running, and
// none of it is read through `fetch`, so Next would otherwise prerender this at
// build time.
export const dynamic = "force-dynamic";

export default async function CashierPreorderPage() {
  await requireRole("KASIR", "ADMIN");

  const [orders, settings, identity, schedule] = await Promise.all([
    findPreordersForCashier(),
    getSettings(),
    getSiteIdentity(),
    getBookableSchedule(undefined, { staff: true }),
  ]);

  // Plain values only — Prisma rows carry Temporal instants that cannot cross
  // the server/client boundary.
  const preorders = orders.map(toCashierPreorder);

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        className="mb-0"
        tag="Pickup gate"
        title="Preorder"
        lede="Cari pesanannya pas pelanggan datang, terus ikuti satu tombol yang muncul"
      />

      <PreorderScreen
        preorders={preorders}
        qrisImageUrl={settings.qrisImageUrl ?? null}
        brand={identity.brandName}
        schedule={schedule}
      />
    </div>
  );
}
