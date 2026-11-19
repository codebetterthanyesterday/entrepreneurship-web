import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { BRAND_NAME } from "@/lib/brand";
import { countUnfinishedPreorders } from "@/lib/queries/order.query";
import { needsPasswordChange } from "@/lib/services/account.service";
import { roleNeedsPreorderCount } from "@/lib/navigation";
import { displayRole, homeFor, rolePill } from "@/lib/staff-chrome";
import { BrandMark } from "@/components/site/brand-mark";
import { KingdomRoot } from "@/components/site/kingdom-root";
import { StaffNav } from "@/components/nav/staff-nav";
import { PasswordNotice } from "@/components/staff/password-notice";
import { StaffStrip } from "@/components/staff/staff-strip";
import "../kingdom.css";
import "../staff.css";

/** Never in a search engine: the staff side is not meant to be found. */
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // The proxy already answers 404 here for a visitor without a session; this
  // is the same answer should a request ever reach the layout without one.
  // Never a redirect to the sign-in page: that would give its address away.
  if (!session?.user) {
    notFound();
  }

  const { role } = session.user;
  const name = session.user.name ?? "Tim";
  const roleLabel = displayRole(role);

  // The one counter in a staff bar is the cashier's preorder badge, so the COUNT
  // is read only for the roles whose bar can show it. It is the query /kasir was
  // already running for its own tabs; the tabs moved up here, and so did it.
  const pendingPreorders = roleNeedsPreorderCount(role) ? await countUnfinishedPreorders() : 0;

  // One lookup by primary key, on every staff screen. Deliberate: the accounts
  // script hands out a password anybody on the team can guess, so the nudge has
  // to follow the person around until they deal with it — and it has to vanish
  // the moment they do, which a flag carried in the twelve-hour session would not.
  const mustChangePassword = await needsPasswordChange(session.user.id);

  return (
    // The same Snack Kingdom as the customer pages, in work mode: no sky, no
    // clouds, no tilted snapshots — staff screens are read fast and used all
    // day. `staffRole` is what gives each role its colour (`staff.css`).
    <KingdomRoot staffRole={role} className="s-shell min-h-screen flex flex-col">
      <header className="s-top">
        <div className="s-wrap">
          <Link href={homeFor(role)} className="s-brand">
            <BrandMark className="s-logo" />
            <span className="min-w-0">
              <span className="s-brand-name">{BRAND_NAME}</span>
              <span className="s-role-pill">{rolePill(role)}</span>
            </span>
          </Link>

          <div className="s-who">
            <span className="s-who-text">
              <b>{name}</b>
              <span>Lagi jaga · {roleLabel}</span>
            </span>
            <Link href="/akun" className="s-avatar" aria-label={`Akun ${name}`}>
              {name.charAt(0).toUpperCase()}
            </Link>
          </div>
        </div>
      </header>

      {/*
        A sibling of the header, not a child of it: on a phone the bar is
        `position: fixed`, and nesting that inside the header's
        `position: sticky` is a shape WebKit has historically got wrong. From
        1040px up it is laid over the header's middle — see `.s-nav`.
      */}
      <StaffNav role={role} roleLabel={roleLabel} pendingPreorders={pendingPreorders} />

      <StaffStrip role={role} />

      {/*
        A notice rather than a locked door. Forcing the change before anything
        else would be safer on paper and worse in the tent: somebody arriving to
        cover the till mid-rush would be stuck on a form instead of serving, and
        a password nobody has thought about yet gets typed as whatever is
        fastest. It stays on every screen until it is dealt with.
      */}
      {mustChangePassword && <PasswordNotice />}

      {/*
        Every role has a bar now — the account tab gives even the kitchen a
        second item — so every page clears it. `--nav-bar-height` is 0 from
        1040px up, where the bar has moved into the header.
      */}
      <main className="s-main flex-1">
        <div className="s-wrap">{children}</div>
      </main>
    </KingdomRoot>
  );
}
