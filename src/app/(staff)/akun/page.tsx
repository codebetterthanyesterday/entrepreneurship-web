import { pageTitle } from "@/lib/brand";
import { requireAuth } from "@/lib/session";
import { needsPasswordChange } from "@/lib/services/account.service";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

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
    <div className="max-w-[34rem] mx-auto">
      <p className="eyebrow text-pink-deep">Akun</p>
      <h1 className="display-3 mt-3 text-ink">{user.name}</h1>
      <p className="mt-1.5 text-[13.5px] text-ink-soft">
        {user.email} &middot; {displayRole}
      </p>

      <div className="mt-8 border-t border-line pt-8">
        <ChangePasswordForm mustChange={mustChange} />
      </div>
    </div>
  );
}
