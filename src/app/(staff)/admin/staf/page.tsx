import { headers } from "next/headers";
import { requireRole } from "@/lib/session";
import { listStaff } from "@/lib/services/staff.service";
import { staffLoginPath } from "@/lib/staff-entrance";
import { StaffManager } from "@/components/admin/staff-manager";
import { pageTitle } from "@/lib/brand";
import { PageHead } from "@/components/staff/page-head";
import Link from "next/link";

export const metadata = {
  title: pageTitle("Staf"),
};

// Accounts change from this very screen; nothing here may be prerendered.
export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const admin = await requireRole("ADMIN");
  const [accounts, requestHeaders] = await Promise.all([listStaff(), headers()]);

  // The address handed over with a new password. Only admins see this page,
  // and they hold the address already.
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const loginUrl = `${protocol}://${host}${staffLoginPath()}`;

  return (
    <div>
      <Link href="/admin/pengaturan" className="mb-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-ink-soft hover:text-ink">
        ← Pengaturan
      </Link>
      <PageHead
        tag="Guild roster"
        title="Staf"
        lede="Tambah akun kasir, dapur, dan admin; nonaktifkan yang sudah nggak bertugas; reset password yang lupa"
      />
      <StaffManager accounts={accounts} selfId={admin.id} loginUrl={loginUrl} />
    </div>
  );
}
