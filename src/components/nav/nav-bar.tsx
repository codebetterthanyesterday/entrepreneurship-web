"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavIconGlyph } from "@/components/nav/nav-icons";
import { isNavItemActive, type NavBadge, type NavItem } from "@/lib/navigation";

/**
 * What a counter on an item means, spelled out for a screen reader — "3" on its
 * own tells someone listening nothing at all.
 */
const BADGE_MEANING: Record<NavBadge, (count: number) => string> = {
  preorder: (count) => `${count} preorder belum selesai`,
  cart: (count) => `${count} item di keranjang`,
};

export interface NavBarProps {
  items: readonly NavItem[];
  /** Names the landmark, since a page may hold more than one `<nav>`. */
  label: string;
  /** Live counts, keyed by the badge an item asked for. Absent or 0 draws nothing. */
  counts?: Partial<Record<NavBadge, number>>;
  /**
   * Constrains the row of links while the bar itself still spans the viewport —
   * `"max-w-7xl mx-auto"` on both the customer and the staff pages, so the pills
   * line up with a header that is centred the same way.
   */
  contentClassName?: string;
}

/**
 * One list of destinations, in two shapes.
 *
 * On a phone it is a bar fixed to the bottom of the screen, where a thumb can
 * reach it without letting go of the phone — the whole point, for someone
 * holding a queue at a booth. From 640px up the same list rides directly under
 * the identity header as a row of pills, and the bottom edge goes back to the
 * page.
 *
 * It is one element in both shapes rather than two hidden copies, so there is a
 * single set of links in the accessibility tree and a single `aria-current`.
 * That is why the switch is all in the class list. It sits as a sibling of the
 * header, never inside it: `position: fixed` nested in the header's
 * `position: sticky` is a shape WebKit has historically got wrong, and a booth
 * runs on phones.
 *
 * Two heights are written down in `globals.css` as `--nav-bar-height` and
 * `--nav-row-height` — the page's bottom padding, the sticky action bars above
 * this one, and `scroll-padding-top` all have to agree with them, so they are
 * declared in one place rather than guessed at four call sites.
 */
export function NavBar({ items, label, counts, contentClassName }: NavBarProps) {
  const pathname = usePathname();

  // Where the actor's own pages stop and another actor's screens begin. -1 when
  // there are none, which is every role but ADMIN.
  const firstCrossArea = items.findIndex((item) => item.crossArea);

  return (
    <nav
      aria-label={label}
      className={cn(
        "z-40 bg-white border-line",
        // Phone: hold the bottom edge, and take the home-indicator inset so the
        // labels are not sitting under it. `viewportFit: "cover"` in the root
        // layout is what makes `env()` report a real number here.
        "fixed inset-x-0 bottom-0 border-t-[1.5px] px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))]",
        // Tablet and up: a row under the 64px header, sticking with it.
        "tablet:sticky tablet:inset-x-auto tablet:bottom-auto tablet:top-16",
        "tablet:border-t-0 tablet:border-b-[1.5px] tablet:px-4 tablet:py-2",
      )}
    >
      <div className={cn("flex items-stretch gap-0.5 tablet:gap-1.5", contentClassName)}>
        {items.map((item, index) => {
          const active = isNavItemActive(item, pathname);
          const count = item.badge ? (counts?.[item.badge] ?? 0) : 0;
          const short = item.shortLabel ?? item.label;

          return (
            <React.Fragment key={item.href}>
              {index === firstCrossArea && index > 0 && (
                <span
                  aria-hidden="true"
                  className="my-1.5 mx-1 w-px flex-none self-stretch bg-line tablet:my-1"
                />
              )}

              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // Phone: icon over label, every item the same width. min-h 48
                  // plus the bar's own padding clears the project's 44px touch
                  // floor with room to spare.
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 py-1",
                  "min-h-[48px] text-[10px] font-semibold leading-[1.2] text-center transition-colors",
                  // A narrow phone with six items has under 50px per label, so a
                  // long word breaks rather than spilling over its neighbour.
                  "[overflow-wrap:anywhere]",
                  // Tablet and up: a pill, sized to its label, icon beside it.
                  "tablet:min-h-[44px] tablet:flex-none tablet:flex-row tablet:gap-2 tablet:px-3.5",
                  "tablet:text-[13.5px] tablet:font-bold",
                  active
                    ? // pink for the actor's own pages, sky for another actor's —
                      // both filled, both carrying white at over 5:1.
                      item.crossArea
                      ? "bg-sky-deep text-white"
                      : "bg-pink-deep text-white"
                    : cn(
                        "hover:bg-cream tablet:hover:bg-pink-soft",
                        // Sky ink marks the cross-role group even when it is not
                        // the current page, so the shortcuts stay legible as
                        // "somewhere else" without a second divider.
                        item.crossArea ? "text-sky-deep tablet:hover:bg-sky-soft" : "text-ink-soft",
                      ),
                )}
              >
                <NavIconGlyph
                  name={item.icon}
                  className="h-[21px] w-[21px] flex-none tablet:h-4 tablet:w-4"
                />

                {short === item.label ? (
                  <span>{item.label}</span>
                ) : (
                  <>
                    <span className="tablet:hidden">{short}</span>
                    <span className="hidden tablet:inline">{item.label}</span>
                  </>
                )}

                {count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] font-bold leading-[1.5] tabular-nums",
                      // On a phone the count rides on the icon's shoulder rather
                      // than taking a third line, so an arriving preorder never
                      // changes the height of the bar under the page.
                      "absolute right-2 top-0.5 min-w-[17px] text-center",
                      "tablet:static tablet:right-auto tablet:top-auto tablet:min-w-0",
                      // On a filled item the count goes white-on-fill, which is
                      // the one combination that drops under 4.5:1 — so it is
                      // white-backed with the fill's own colour on it instead.
                      active
                        ? item.crossArea
                          ? "bg-white text-sky-deep"
                          : "bg-white text-pink-deep"
                        : "bg-pink-soft text-pink-deep",
                    )}
                  >
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
      </div>
    </nav>
  );
}
