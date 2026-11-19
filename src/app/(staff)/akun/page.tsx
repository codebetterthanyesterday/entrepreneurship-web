import { pageTitle } from "@/lib/brand";
import { requireAuth } from "@/lib/session";
import { needsPasswordChange } from "@/lib/services/account.service";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { PageHead } from "@/components/staff/page-head";
import { LogoutButton } from "@/components/auth/logout-button";
import { staffLoginPath } from "@/lib/staff-entrance";

export const metadata = {
  title: pageTitle("Akun"),
};

// Reads the signed-in user's row, which changes the moment they save.
export const dynamic = "force-dynamic";

/**
 * Where a staff member changes their own password.
 *
 * No `requireRole`: every role owns its own account. `requireAuth` is enough, and
 * the `(staff)` layout has already redirected anybody without a session to the
 * login screen — which is also why this path needs no entry in the proxy's
 * role table.
 */
export default async function AccountPage() {
  const user = await requireAuth();
  const mustChange = await needsPasswordChange(user.id);

  const displayRole = user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase();

  return (
    <div className="max-w-[36rem]">
      <PageHead
        tag="Player profile"
        title={`Akun ${user.name}`}
        lede={
          <>
            {user.email} &middot; {displayRole}
          </>
        }
      />

      <div className="flex flex-col gap-5">
        <div className="s-card">
          <ChangePasswordForm mustChange={mustChange} />
        </div>

        {/* Signing out lives here rather than in the header: the header on a
            phone is the brand and the avatar, and the avatar leads here. */}
        <div className="flex items-center justify-between gap-3 s-slab p-3.5">
          <span className="text-sm text-ink-soft">Selesai jaga? Keluar biar akun nggak dipakai orang lain.</span>
          <LogoutButton loginPath={staffLoginPath()} />
        </div>
      </div>
    </div>
  );
}
