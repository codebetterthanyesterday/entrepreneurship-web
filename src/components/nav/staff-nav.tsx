"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { NavBar } from "@/components/nav/nav-bar";
import { hasSomewhereToGo, staffNavFor } from "@/lib/navigation";

export interface StaffNavProps {
  role: string;
  /** "Admin", "Kasir", "Dapur" — names the landmark the way the header does. */
  roleLabel: string;
  pendingPreorders: number;
}

/**
 * The staff navigation.
 *
 * It is a client component because the list depends on where the actor is
 * standing, not only on who they are: an admin inside /kasir is shown the till's
 * screens with a way back out, and only `usePathname` can tell us that. The
 * layout above cannot read the URL at all.
 */
export function StaffNav({ role, roleLabel, pendingPreorders }: StaffNavProps) {
  const pathname = usePathname();
  const items = staffNavFor(role, pathname);

  // DAPUR signed in on its one screen. The layout has already left the page's
  // bottom padding off for this case — `roleHasNav` answers the same question
  // from the role alone.
  if (!hasSomewhereToGo(items)) return null;

  return (
    <NavBar
      items={items}
      label={`Navigasi ${roleLabel}`}
      counts={{ preorder: pendingPreorders }}
      contentClassName="max-w-7xl mx-auto w-full"
    />
  );
}
