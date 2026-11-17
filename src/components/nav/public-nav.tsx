"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIconGlyph } from "@/components/nav/nav-icons";
import { PUBLIC_NAV, isNavItemActive } from "@/lib/navigation";
import { useCartCount } from "@/hooks/use-cart";

/**
 * The customer's navigation, in the Snack Kingdom's shape.
 *
 * Mobile-first: on a phone it is a tab bar fixed to the bottom edge, where a
 * thumb reaches it without letting go of the phone. From 640px up the same
 * three links move into the middle of the header, which is where the design
 * draws them. One element in both shapes rather than two hidden copies, so
 * there is a single set of links in the accessibility tree and a single
 * `aria-current`; the switch is all in `.k-nav` (`kingdom.css`).
 *
 * The staff screens keep the shared `NavBar`. This one is its own component
 * because the two no longer look alike, but it reads the same list and the same
 * active-item rule from `navigation.ts`, and keeps `data-nav-badge` on the cart
 * link — that is where `flyToCart` aims.
 *
 * A client component because the cart count lives in the browser.
 */
export function PublicNav() {
  const pathname = usePathname();
  const cart = useCartCount();

  return (
    <nav aria-label="Navigasi utama" className="k-nav">
      {PUBLIC_NAV.map((item) => {
        const active = isNavItemActive(item, pathname);
        const count = item.badge === "cart" ? cart : 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            data-nav-badge={item.badge}
            className="k-nav-item"
          >
            <NavIconGlyph name={item.icon} className="h-[22px] w-[22px] flex-none" />
            {item.shortLabel ? (
              <>
                <span className="desktop:hidden">{item.shortLabel}</span>
                <span className="hidden desktop:inline">{item.label}</span>
              </>
            ) : (
              <span>{item.label}</span>
            )}

            {count > 0 && (
              // Keyed on the count, so each change remounts it and pops.
              <span key={count} className="k-nav-count nav-count-pop tabular-nums">
                {count > 99 ? "99+" : count}
                <span className="sr-only"> item di keranjang</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The bag in the header's corner, as the design draws it: how many items, one
 * tap from the cart. It stays on a phone too — the count is the one thing a
 * customer checks while scrolling the menu, and the header is always on screen.
 */
export function HeaderBag() {
  const cart = useCartCount();

  return (
    <Link href="/keranjang" aria-label={`Keranjang, ${cart} item`} className="k-bag">
      <NavIconGlyph name="keranjang" className="h-5 w-5 flex-none" />
      <span className="k-bag-count tabular-nums">x{cart}</span>
    </Link>
  );
}
