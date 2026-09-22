import { requireRole } from "@/lib/session";
import { getPickupSlots, getSettings } from "@/lib/services/setting.service";
import { StoreToggles } from "@/components/admin/store-toggles";
import { PickupSlotManager } from "@/components/admin/pickup-slot-manager";
import { MiscSettingsForm } from "@/components/admin/misc-settings-form";
import { ExportPanel } from "@/components/admin/export-panel";
import type { AdminPickupSlot } from "@/types/admin";
import { pageTitle } from "@/lib/brand";

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
    <div className="flex flex-col gap-7 max-w-[720px] mx-auto">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
          Pengaturan
        </h1>
        <p className="text-sm text-ink-soft">Atur kanal jualan, slot ambil, dan detail toko</p>
      </div>

      <StoreToggles preorderOpen={settings.preorderOpen} boothOpen={settings.boothOpen} />

      <PickupSlotManager slots={slotItems} />

      <MiscSettingsForm
        lowStockThreshold={settings.lowStockThreshold}
        adminWhatsapp={settings.adminWhatsapp}
        qrisImageUrl={settings.qrisImageUrl}
      />

      <ExportPanel />
    </div>
  );
}
