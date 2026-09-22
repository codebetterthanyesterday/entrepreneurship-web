import * as React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { countUnfinishedPreorders } from "@/lib/queries/order.query";
import { needsPasswordChange } from "@/lib/services/account.service";
import { roleHasNav, roleNeedsPreorderCount } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { StaffNav } from "@/components/nav/staff-nav";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { name, role } = session.user;
  const displayRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();

  // Which screens the bar offers depends on the URL, so `StaffNav` works that
  // out in the browser. What the layout has to know here is only whether there
  // will be a bar at all, because the page's bottom padding has to leave room
  // for it — and that follows from the role: DAPUR has one screen and gets none.
  const showNav = roleHasNav(role);

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
    <div className="min-h-screen flex flex-col bg-cream">
      {/* Sticky Header */}
      <header className="bg-white border-b-[1.5px] border-line sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-pink-deep uppercase tracking-wider">
              {displayRole} Panel
            </span>
            <span className="text-sm font-medium text-ink">
              Lagi jaga: {name} &middot; {displayRole}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/akun"
              className="min-h-[44px] px-3 flex items-center rounded-xl text-[13px] font-medium text-ink-soft hover:bg-cream hover:text-ink transition-colors"
            >
              Akun
            </Link>
            <LogoutButton />
          </div>
        </div>

        {/*
          A notice rather than a locked door. Forcing the change before anything
          else would be safer on paper and worse in the tent: somebody arriving to
          cover the till mid-rush would be stuck on a form instead of serving, and
          a password nobody has thought about yet gets typed as whatever is
          fastest. It stays on every screen until it is dealt with.
        */}
        {mustChangePassword && (
          <Link
            href="/akun"
            className="block border-t border-warn/30 bg-warn-soft px-4 py-2.5 text-[12.5px] font-medium text-warn hover:brightness-[0.97]"
          >
            <span className="block max-w-7xl mx-auto">
              Akun kamu masih pakai password awal yang dibagikan bareng-bareng — ganti sekarang &rarr;
            </span>
          </Link>
        )}
      </header>

      {/*
        A sibling of the header, not a child of it: on a phone the bar is
        `position: fixed`, and nesting that inside the header's
        `position: sticky` is a shape WebKit has historically got wrong. From
        640px up it sticks at `top-16`, directly under the header.
      */}
      <StaffNav role={role} roleLabel={displayRole} pendingPreorders={pendingPreorders} />

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 p-4",
          // Clear the fixed bottom bar so the last card is not stuck behind it.
          // The variable is 0 from 640px up, where the bar is no longer down there.
          showNav && "pb-[calc(1rem+var(--nav-bar-height))]",
        )}
      >
        {/*
          The same 80rem measure as the header and the nav row above, so on a
          wide monitor the page sits in the middle under them instead of hugging
          the left edge. Screens with a narrower form of their own (Akun,
          Pengaturan) centre themselves inside this.
        */}
        <div className="max-w-7xl mx-auto w-full">{children}</div>
      </main>
    </div>
  );
}
