"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * The four worlds of ordering, in the order a customer meets them, and the
 * paths that belong to each. A single order's page is the tracker's.
 */
const WORLDS = [
  { label: "Menu", name: "Pilih menu", paths: ["/"] },
  { label: "Cart", name: "Keranjang", paths: ["/keranjang"] },
  { label: "Data", name: "Isi data", paths: ["/checkout"] },
  { label: "Track", name: "Lacak pesanan", paths: ["/lacak", "/pesanan"] },
] as const;

/** Which world a path is in, 0-based; -1 for a page outside the journey. */
export function worldOf(pathname: string): number {
  return WORLDS.findIndex((world) =>
    world.paths.some((path) =>
      path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`),
    ),
  );
}

/**
 * The strip under the header: "01 MENU (W1)" to "04 TRACK (W4)", with the
 * world the customer is in picked out.
 *
 * It replaces the dotted rail that each page's hero used to carry, so the
 * progress is in one place on every page instead of being redrawn by each. It
 * is orientation, not navigation — nothing here is a link, because the tab bar
 * right below (or above) already goes to every one of these places, and a
 * second set of the same links is noise to someone tabbing through.
 */
export function WorldSteps() {
  const current = worldOf(usePathname());

  return (
    <div className="k-steps">
      <ol aria-label="Langkah pemesanan" className="band-inner">
        {WORLDS.map((world, index) => {
          const state = index < current ? "done" : index === current ? "current" : "ahead";

          return (
            <li
              key={world.label}
              className="k-step"
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span aria-hidden="true">
                0{index + 1} {world.label}
                <span className="k-step-world"> (W{index + 1})</span>
              </span>
              <span className="sr-only">
                Langkah {index + 1}: {world.name}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
