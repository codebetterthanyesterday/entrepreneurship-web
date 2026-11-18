import { requireRole } from "@/lib/session";
import { getSettings } from "@/lib/services/setting.service";
import { getScheduleForAdmin } from "@/lib/queries/schedule.query";
import { DEFAULT_CUTOFF_MINUTE, todayInJakarta } from "@/lib/schedule";
import { StoreToggles } from "@/components/admin/store-toggles";
import { ScheduleManager } from "@/components/admin/schedule-manager";
import { DEFAULT_CHAT_CLOSE_MINUTE, DEFAULT_CHAT_OPEN_MINUTE } from "@/lib/whatsapp";
import { MiscSettingsForm } from "@/components/admin/misc-settings-form";
import { QrisUploader } from "@/components/admin/qris-uploader";
import { ExportPanel } from "@/components/admin/export-panel";
import { pageTitle } from "@/lib/brand";
import { PageHead } from "@/components/staff/page-head";

export const metadata = {
  title: pageTitle("Pengaturan"),
};

export default async function AdminSettingsPage() {
  await requireRole("ADMIN");

  const today = todayInJakarta();
  const [settings, days] = await Promise.all([getSettings(), getScheduleForAdmin(today)]);

  return (
    <div>
      <PageHead
        tag="Kingdom rules"
        title="Pengaturan"
        lede="Atur kanal jualan, jadwal preorder, dan detail toko"
      />

      {/* One column on a phone and a tablet; two from the desktop up, with
          the export list across the bottom. */}
      <div className="grid gap-8 desktop:grid-cols-2 desktop:items-start">
        <StoreToggles
          preorderOpen={settings.preorderOpen}
          boothOpen={settings.boothOpen}
        />

        <ScheduleManager
          days={days}
          today={today}
          cutoffMinute={settings.orderCutoffMinute ?? DEFAULT_CUTOFF_MINUTE}
        />

        <QrisUploader qrisImageUrl={settings.qrisImageUrl ?? null} />

        <MiscSettingsForm
          lowStockThreshold={settings.lowStockThreshold}
          adminWhatsapp={settings.adminWhatsapp}
          chatOpenMinute={settings.chatOpenMinute ?? DEFAULT_CHAT_OPEN_MINUTE}
          chatCloseMinute={settings.chatCloseMinute ?? DEFAULT_CHAT_CLOSE_MINUTE}
        />

        <div className="desktop:col-span-2">
          <ExportPanel />
        </div>
      </div>
    </div>
  );
}
