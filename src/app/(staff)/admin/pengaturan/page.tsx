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
import { ButtonLink } from "@/components/ui/button";
import { hasAnyPhotoboothCharge } from "@/lib/queries/external-charge.query";
import { pageTitle } from "@/lib/brand";
import { PageHead } from "@/components/staff/page-head";

export const metadata = {
  title: pageTitle("Pengaturan"),
};

export default async function AdminSettingsPage() {
  await requireRole("ADMIN");

  const today = todayInJakarta();
  const [settings, days, photoboothCharges] = await Promise.all([
    getSettings(),
    getScheduleForAdmin(today),
    hasAnyPhotoboothCharge(),
  ]);

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

        {/* Not in the bar: an admin's bar is already six wide on a phone, and
            accounts are managed now and then, not during service. */}
        <section className="flex flex-col gap-2.5">
          <h2 className="s-h2">Akun staf</h2>
          <div className="s-slab flex flex-col gap-3 p-3.5">
            <p className="text-sm text-ink-soft">
              Tambah akun kasir, dapur, atau admin, nonaktifkan yang sudah nggak bertugas, dan reset password yang lupa.
            </p>
            <ButtonLink href="/admin/staf" variant="flat" size="sm" className="self-start px-5">
              Kelola akun staf
            </ButtonLink>
          </div>
        </section>

        <div className="desktop:col-span-2">
          <ExportPanel photobooth={photoboothCharges} />
        </div>
      </div>
    </div>
  );
}
