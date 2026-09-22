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
  { id: "menu", label: "Menu", href: "/menu" },
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
 * The dark band every ordering page opens with: where you are, what this page
 * is for, a picture of it, and the rail underneath.
 *
 * Deliberately `band-tight`. These are working pages, and on a phone the first
 * menu item or the first field has to be on screen without a scroll — the full
 * stage treatment belongs to the tracker, where the stage *is* the content.
 */
export function JourneyHero({ step, eyebrow, title, lede, art }: JourneyHeroProps) {
  return (
    // Tighter than `band-tight` on a phone, where every row of hero is a row of
    // menu or form pushed below the fold; the shared rhythm returns from 640px.
    <section className="band-dark pt-6 pb-4 tablet:py-[var(--band-y-tight)]">
      {/* `relative` so that from a tablet up the picture can leave the title's
          row and sit beside the whole block — kept in the row, its height
          pushed a gap between the title and the lede on a wide screen. */}
      <div className="band-inner stage-enter relative">
        <div className="flex items-start justify-between gap-4 tablet:block">
          <div className="min-w-0 tablet:pr-48">
            <p className="eyebrow text-pink">{eyebrow}</p>
            <h1 className="display-2 mt-3 text-white">{title}</h1>
          </div>

          <div className="-mt-1 h-[4.5rem] w-[4.5rem] flex-none tablet:absolute tablet:right-4 tablet:top-1/2 tablet:mt-0 tablet:h-36 tablet:w-36 tablet:-translate-y-1/2">
            {art}
          </div>
        </div>

        {lede && <p className="journey-lede mt-3 text-white/70 tablet:mt-4">{lede}</p>}

        <JourneyRail current={step} className="mt-4 max-w-[28rem] tablet:mt-8" />
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
