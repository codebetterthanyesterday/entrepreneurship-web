"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavIconGlyph } from "@/components/nav/nav-icons";
import {
  STAFF_ACCOUNT_ITEM,
  hasSomewhereToGo,
  isNavItemActive,
  staffTabsFor,
  type NavBadge,
} from "@/lib/navigation";

/**
 * What a counter on an item means, spelled out for a screen reader — "3" on its
 * own tells someone listening nothing at all.
 */
const BADGE_MEANING: Record<NavBadge, (count: number) => string> = {
  preorder: (count) => `${count} preorder belum selesai`,
  cart: (count) => `${count} item di keranjang`,
};

export interface StaffNavProps {
  role: string;
  /** "Admin", "Kasir", "Dapur" — names the landmark the way the header does. */
  roleLabel: string;
  pendingPreorders: number;
}

/**
 * The staff navigation, in the Snack Kingdom's shape.
 *
 * Mobile-first: on a phone and a tablet it is a tab bar fixed to the bottom
 * edge, the active tab filled with the role's colour, where a thumb reaches it
 * mid-rush. From 1040px up the same links sit in the middle of the header as a
 * row of pills. One element in both shapes rather than two hidden copies, so
 * there is a single set of links in the accessibility tree and a single
 * `aria-current`; the switch is all in `.s-nav` (`staff.css`).
 *
 * It is a client component because the list depends on where the actor is
 * standing, not only on who they are: an admin inside /kasir is shown the till's
 * screens with a way back out, and only `usePathname` can tell us that.
 */
export function StaffNav({ role, roleLabel, pendingPreorders }: StaffNavProps) {
  const pathname = usePathname();
  const items = staffTabsFor(role, pathname);

  if (!hasSomewhereToGo(items)) return null;

  // Where the actor's own pages stop and another area's screens begin. -1 when
  // there are none, which is every role but ADMIN.
  const firstCrossArea = items.findIndex((item) => item.crossArea);
  const counts: Partial<Record<NavBadge, number>> = { preorder: pendingPreorders };

  // The kitchen's bar is its one screen plus the account. In the header the
  // account is the avatar, which would leave a row of one: a label, not
  // navigation, so from 1040px up that row is not drawn at all.
  const solo = items.filter((item) => item.href !== STAFF_ACCOUNT_ITEM.href).length < 2;

  return (
    <nav aria-label={`Navigasi ${roleLabel}`} className={cn("s-nav", solo && "s-nav-solo")}>
      {items.map((item, index) => {
        const active = isNavItemActive(item, pathname);
        const count = item.badge ? (counts[item.badge] ?? 0) : 0;
        const short = item.shortLabel ?? item.label;

        return (
          <React.Fragment key={item.href}>
            {index === firstCrossArea && index > 0 && (
              <span aria-hidden="true" className="s-nav-sep" />
            )}

            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              data-nav-badge={item.badge}
              className={cn(
                "s-nav-item",
                item.crossArea && "s-nav-cross",
                item.href === STAFF_ACCOUNT_ITEM.href && "s-nav-account",
              )}
            >
              <NavIconGlyph name={item.icon} className="s-nav-icon" />

              {short === item.label ? (
                <span>{item.label}</span>
              ) : (
                <>
                  <span className="desktop:hidden">{short}</span>
                  <span className="hidden desktop:inline">{item.label}</span>
                </>
              )}

              {count > 0 && (
                // Keyed on the count, so each change remounts it and pops.
                <span key={count} className="s-nav-count nav-count-pop tabular-nums">
                  {count > 99 ? "99+" : count}
                  {item.badge && (
                    <span className="sr-only"> {BADGE_MEANING[item.badge](count)}</span>
                  )}
                </span>
              )}
            </Link>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
