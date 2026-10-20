import { requireRole } from "@/lib/session";
import { findActiveCharges } from "@/lib/queries/external-charge.query";
import { findPreordersForCashier, toCashierPreorder } from "@/lib/queries/order.query";
import { getSettings } from "@/lib/services/setting.service";
import { PreorderScreen } from "@/components/kasir/preorder-screen";
import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Preorder"),
};

// Preorders arrive and the kitchen moves them while the event is running, and
// none of it is read through `fetch`, so Next would otherwise prerender this at
// build time.
export const dynamic = "force-dynamic";

export default async function CashierPreorderPage() {
  await requireRole("KASIR", "ADMIN");

  const [orders, settings] = await Promise.all([findPreordersForCashier(), getSettings()]);

  // Plain values only — Prisma rows carry Temporal instants that cannot cross
  // the server/client boundary.
  // Photobooth charges (BPB-098) show beside each preorder, already paid.
  const charges = await findActiveCharges(orders.map((order) => order.id));
  const preorders = orders.map((order) =>
    toCashierPreorder(order, charges.get(order.id)),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
          Preorder
        </h1>
        <p className="text-sm text-ink-soft">
          Cari pesanannya pas pelanggan datang, terus ikuti satu tombol yang muncul
        </p>
      </div>

      <PreorderScreen preorders={preorders} qrisImageUrl={settings.qrisImageUrl ?? null} />
    </div>
  );
}
