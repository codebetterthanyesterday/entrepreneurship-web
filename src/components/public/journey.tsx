import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EmptyBagArt } from "./journey-art";

/**
 * The four stops of ordering, in the order a customer meets them. The tracker
 * is the last one: it is where the same journey carries on after the order has
 * been sent, drawn as the stage instead of as this rail.
 */
const JOURNEY = [
  { id: "menu", label: "Menu", href: "/" },
  { id: "cart", label: "Keranjang", href: "/keranjang" },
  { id: "data", label: "Isi data", href: "/checkout" },
  { id: "track", label: "Lacak", href: "/lacak" },
] as const;

export type JourneyStep = (typeof JOURNEY)[number]["id"];

/**
 * Where the customer is in ordering, as a thin rail of four dots.
 *
 * Only the stops behind them are links — going back to the menu from the cart
 * is a natural move, but "Isi data" is not somewhere to jump ahead to with an
 * empty cart. The current stop is `aria-current="step"`, the same way the
 * tracker's timeline marks its own.
 */
export function JourneyRail({ current, className }: { current: JourneyStep; className?: string }) {
  const currentIndex = JOURNEY.findIndex((stop) => stop.id === current);

  return (
    <nav aria-label="Langkah pemesanan" className={className}>
      <ol className="flex">
        {JOURNEY.map((stop, index) => {
          const state =
            index < currentIndex ? "done" : index === currentIndex ? "current" : "ahead";
          const reached = state !== "ahead";

          const label = (
            <>
              {/* A fixed 14px box, so the larger current dot does not push its
                  label lower than its neighbours' or tilt the line. */}
              <span
                aria-hidden="true"
                className="relative z-10 flex h-3.5 items-center justify-center"
              >
                <span
                  className={cn(
                    "block rounded-full transition-transform",
                    state === "current"
                      ? "h-3.5 w-3.5 bg-pink ring-4 ring-pink/25"
                      : state === "done"
                        ? "h-2.5 w-2.5 bg-pink group-hover:scale-125"
                        : "h-2.5 w-2.5 border-2 border-white/30 bg-ink-deep",
                  )}
                />
              </span>
              <span
                className={cn(
                  "mt-1.5 block text-[10.5px] font-semibold leading-tight tablet:mt-2 tablet:text-[11px]",
                  state === "current"
                    ? "text-white"
                    : state === "done"
                      ? "text-white/70 group-hover:text-white"
                      : "text-white/55",
                )}
              >
                {stop.label}
              </span>
            </>
          );

          return (
            <li
              key={stop.id}
              aria-current={state === "current" ? "step" : undefined}
              className="relative flex flex-1 flex-col items-center text-center"
            >
              {/* The segment arriving at this stop, from the one before. */}
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute right-1/2 top-[7px] h-0.5 w-full -translate-y-1/2",
                    reached ? "bg-pink" : "bg-white/15",
                  )}
                />
              )}

              {state === "done" ? (
                <Link
                  href={stop.href}
                  className="group flex min-h-[44px] min-w-[44px] flex-col items-center rounded-lg px-1"
                >
                  {label}
                </Link>
              ) : (
                <span className="flex min-h-[44px] min-w-[44px] flex-col items-center px-1">
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface JourneyHeroProps {
  step: JourneyStep;
  eyebrow: string;
  title: string;
  lede?: string;
  /** The page's picture, from `journey-art.tsx`. */
  art: React.ReactNode;
}

/**
 * What every ordering page opens with — the design's page head: a lavender
 * panel on a hard shadow, a tag saying where you are, the page's title set
 * large, and a picture of it.
 *
 * Deliberately compact. These are working pages, and on a phone the first cart
 * line or the first field has to be on screen without a scroll.
 *
 * `step` is kept in the props so each page still declares which stop it is,
 * but nothing is drawn from it here any more: the four-stop progress moved to
 * `WorldSteps`, the strip under the header, so it is in one place on every
 * page instead of being redrawn inside each hero.
 */
export function JourneyHero({ eyebrow, title, lede, art }: JourneyHeroProps) {
  return (
    <section className="pt-4 tablet:pt-6">
      <div className="band-inner stage-enter">
        <div className="k-panel flex items-start justify-between gap-4 p-4 tablet:items-center tablet:p-7">
          <div className="min-w-0">
            <p className="k-tag k-tag-yellow">{eyebrow}</p>
            <h1 className="k-page-title mt-3 text-ink">{title}</h1>
            {lede && <p className="journey-lede mt-2 text-ink-soft">{lede}</p>}
          </div>

          {/* The drawings are white-on-colour, made for a dark field, so the
              picture keeps a navy tile of its own on the light panel. */}
          <div className="k-hard-sm h-[4.5rem] w-[4.5rem] flex-none rounded-[14px] bg-ink-deep p-1.5 tablet:h-28 tablet:w-28 tablet:p-2.5">
            {art}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * An empty cart or an empty category, said with the swaying bag rather than a
 * large centred emoji — in the page's own voice, on the light band.
 */
export function JourneyEmpty({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="stage-enter flex max-w-[40rem] flex-col gap-6 tablet:flex-row tablet:items-center tablet:gap-8">
      <div className="h-28 w-28 flex-none tablet:h-36 tablet:w-36">
        <EmptyBagArt />
      </div>

      <div className="max-w-[40ch]">
        <p className="eyebrow text-pink-deep">{eyebrow}</p>
        <p className="display-3 mt-3 text-ink">{title}</p>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">{body}</p>
        {children}
      </div>
    </div>
  );
}
