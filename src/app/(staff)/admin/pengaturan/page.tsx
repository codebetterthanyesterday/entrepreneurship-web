import { requireRole } from "@/lib/session";
import { getPickupSlots, getSettings } from "@/lib/services/setting.service";
import { StoreToggles } from "@/components/admin/store-toggles";
import { PickupSlotManager } from "@/components/admin/pickup-slot-manager";
import { MiscSettingsForm } from "@/components/admin/misc-settings-form";
import { QrisUploader } from "@/components/admin/qris-uploader";
import { ExportPanel } from "@/components/admin/export-panel";
import type { AdminPickupSlot } from "@/types/admin";
import { pageTitle } from "@/lib/brand";
import { PageHead } from "@/components/staff/page-head";

export const metadata = {
  title: pageTitle("Pengaturan"),
};

export default async function AdminSettingsPage() {
  await requireRole("ADMIN");

  const [settings, slots] = await Promise.all([getSettings(), getPickupSlots()]);

  const slotItems: AdminPickupSlot[] = slots.map((slot) => ({
    id: slot.id,
    label: slot.label,
    quota: slot.quota,
    booked: slot.booked,
    sortOrder: slot.sortOrder,
    isActive: slot.isActive,
  }));

  return (
    <div>
      <PageHead
        tag="Kingdom rules"
        title="Pengaturan"
        lede="Atur kanal jualan, slot ambil, dan detail toko"
      />

      {/* One column on a phone and a tablet; two from the desktop up, with
          the export list across the bottom. */}
      <div className="grid gap-8 desktop:grid-cols-2 desktop:items-start">
        <StoreToggles
          preorderOpen={settings.preorderOpen}
          boothOpen={settings.boothOpen}
        />

        <PickupSlotManager slots={slotItems} />

        <QrisUploader qrisImageUrl={settings.qrisImageUrl ?? null} />

        <MiscSettingsForm
          lowStockThreshold={settings.lowStockThreshold}
          adminWhatsapp={settings.adminWhatsapp}
        />

        <div className="desktop:col-span-2">
          <ExportPanel />
        </div>
      </div>
    </div>
  );
}
