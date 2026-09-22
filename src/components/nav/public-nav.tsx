"use client";

import * as React from "react";
import { NavBar } from "@/components/nav/nav-bar";
import { PUBLIC_NAV } from "@/lib/navigation";
import { useCartCount } from "@/hooks/use-cart";

/**
 * The customer's navigation.
 *
 * It is its own client component only because the cart count lives in the
 * browser: the layout above it is a server component and has no way to read
 * localStorage. Everything else comes from the static list in `navigation.ts`.
 */
export function PublicNav() {
  const cart = useCartCount();

  return (
    <NavBar
      items={PUBLIC_NAV}
      label="Navigasi utama"
      counts={{ cart }}
      contentClassName="max-w-7xl mx-auto w-full"
    />
  );
}
