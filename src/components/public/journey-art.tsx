import * as React from "react";
import { cn } from "@/lib/utils";
import { Sparkle } from "./order-stage";

/**
 * The pictures for the ordering pages — the menu, the cart, the checkout, and
 * the menu's own items — drawn in the same hand as the tracker's stage art
 * (`StageArt`): a 120×120 grid, rounded and chunky, the accent for the object and
 * white for its details. Every colour is a token, so they follow the mood.
 *
 * Server-safe like the stage art: all the motion is CSS.
 */

function Art({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn("stage-art h-full w-full overflow-visible", className)}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const delay = (ms: number) => ({ animationDelay: `${ms}ms` }) as React.CSSProperties;

// ------------------------------------------------------ on the dark band

/** The menu: a drink and a doughnut, side by side, bobbing out of step. */
export function MenuArt() {
  return (
    <Art>
      <g className="stage-float">
        <path
          d="M47 38l5-18h7"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-white"
        />
        <path d="M25 46h34l-4 44a5 5 0 0 1-5 4.5H34a5 5 0 0 1-5-4.5z" className="fill-pink" />
        <path d="M28 62h28" strokeWidth="3" strokeLinecap="round" className="stroke-white/30" />
        <rect x="21" y="37" width="42" height="9" rx="4.5" className="fill-white" />
      </g>

      <g className="stage-float" style={delay(-2100)}>
        <circle cx="84" cy="76" r="22" className="fill-pink-soft" />
        <circle cx="84" cy="76" r="17" className="fill-pink" />
        <circle cx="84" cy="76" r="6" className="fill-ink-deep" />
        <g strokeWidth="3" strokeLinecap="round" className="stroke-white">
          <path d="M74 67l3 2" />
          <path d="M92 65l-2 3" />
          <path d="M96 80l-3 1" />
          <path d="M76 86l2-3" />
        </g>
      </g>

      <Sparkle x={100} y={30} size={7} delay={0} />
      <Sparkle x={14} y={30} size={5} delay={800} />
    </Art>
  );
}

/**
 * The cart: a bag with a count on its shoulder. The count is keyed, so the badge
 * pops each time it changes. (Contents peeking over the top were tried, and at
 * header size they read as clutter rather than as a full bag.)
 */
export function CartArt({ count }: { count: number }) {
  const filled = count > 0;

  return (
    <Art>
      <path
        d="M44 50v-8a14 14 0 0 1 28 0v8"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        className="stroke-white"
      />
      <path d="M28 48h60l-4 52a6 6 0 0 1-6 5.5H38A6 6 0 0 1 32 100z" className="fill-pink" />
      <path d="M29 58h58" strokeWidth="3" className="stroke-white/30" />

      {filled ? (
        <g key={count} className="stage-pop">
          <circle cx="90" cy="36" r="15" className="fill-white" />
          <text
            x="90"
            y="41.5"
            textAnchor="middle"
            className="fill-pink-deep font-[family-name:var(--font-display)] text-[16px] font-semibold"
          >
            {count > 99 ? "99+" : count}
          </text>
        </g>
      ) : (
        <Sparkle x={96} y={34} size={7} delay={0} />
      )}
    </Art>
  );
}

/** The checkout: a ticket being written out, a pencil scribbling across it. */
export function CheckoutArt() {
  return (
    <Art>
      <path
        d="M30 18h52a4 4 0 0 1 4 4v72l-6-5-6 5-6-5-6 5-6-5-6 5-6-5-6 5-6-5-6 5V22a4 4 0 0 1 4-4z"
        className="fill-pink"
      />
      <g strokeWidth="5" strokeLinecap="round" className="stroke-white">
        <path d="M40 36h32" pathLength={1} className="art-write" style={delay(0)} />
        <path d="M40 50h22" pathLength={1} className="art-write" style={delay(450)} />
        <path
          d="M40 64h28"
          pathLength={1}
          className="art-write stroke-white/50"
          style={delay(900)}
        />
      </g>

      <g className="art-scribble">
        <path d="M78 96l24-30 8 6-24 30-10 3z" className="fill-white" />
        <path d="M102 66l4-5a4 4 0 0 1 6 5l-4 5z" className="fill-pink-soft" />
        <path d="M76 99l2-6 4 3z" className="fill-ink-deep" />
      </g>

      <Sparkle x={16} y={28} size={6} delay={400} />
    </Art>
  );
}

// ---------------------------------------------------- on a light surface

/** An empty bag, swaying a little — for a cart with nothing in it yet. */
export function EmptyBagArt() {
  return (
    <Art>
      <g className="art-sway">
        <path
          d="M44 48v-8a14 14 0 0 1 28 0v8"
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className="stroke-pink-deep"
        />
        <path
          d="M28 46h60l-4 52a6 6 0 0 1-6 5.5H38A6 6 0 0 1 32 98z"
          className="fill-pink-soft stroke-pink"
          strokeWidth="3"
          strokeDasharray="6 6"
        />
        <path
          d="M50 76q8 6 16 0"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-pink-deep"
        />
        <circle cx="49" cy="66" r="3" className="fill-pink-deep" />
        <circle cx="67" cy="66" r="3" className="fill-pink-deep" />
      </g>
      <Sparkle x={98} y={32} size={7} delay={0} className="fill-pink" />
      <Sparkle x={18} y={52} size={5} delay={900} className="fill-pink" />
    </Art>
  );
}

export type FoodKind = "drink" | "snack";

/*
 * Words that mark something as a drink, in the menu's own language. Checked
 * against the category and the name together, so "Es Kopi Susu" in a category
 * called "Spesial" still gets a cup.
 */
const DRINK_WORDS =
  /\b(minum\w*|drinks?|es|ice[dy]?|kopi|coffee|teh|tea|jus|juice|lemon\w*|soda|susu|milk\w*|latte|matcha|smoothies?|boba|sirup|cokelat panas|air)\b/i;

/** Which picture a product without a photo gets. */
export function foodKindOf(product: { name: string; categoryName: string | null }): FoodKind {
  return DRINK_WORDS.test(`${product.categoryName ?? ""} ${product.name}`) ? "drink" : "snack";
}

/**
 * The stand-in for a product photo: a drink or a doughnut on the soft accent.
 * Most products have no photo, so this is the common case and has to look like
 * a decision — the old grey-ish initial read as a missing file.
 */
export function FoodArt({ kind }: { kind: FoodKind }) {
  if (kind === "drink") {
    return (
      <Art>
        <path
          d="M62 30l6-18h8"
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-pink-deep"
        />
        <path d="M34 40h52l-6 58a6 6 0 0 1-6 5.4H46A6 6 0 0 1 40 98z" className="fill-pink" />
        <rect x="46" y="56" width="13" height="13" rx="3" className="fill-white/70" />
        <rect x="62" y="65" width="12" height="12" rx="3" className="fill-white/55" />
        <path d="M40 84h40" strokeWidth="3" strokeLinecap="round" className="stroke-white/35" />
        <rect x="29" y="29" width="62" height="12" rx="6" className="fill-pink-deep" />
      </Art>
    );
  }

  return (
    <Art>
      <circle cx="60" cy="62" r="38" className="fill-sand" />
      <path
        d="M60 28a34 34 0 0 1 34 34c0 6-5 4-8 9s-3 11-9 10-8-6-17-6-11 6-17 5-6-7-9-11-8-3-8-7a34 34 0 0 1 34-34z"
        className="fill-pink"
      />
      {/* The hole shows the tile behind it. */}
      <circle cx="60" cy="62" r="11" className="fill-pink-soft" />
      <g strokeWidth="4" strokeLinecap="round">
        <path d="M44 44l4 3" className="stroke-white" />
        <path d="M72 40l-3 4" className="stroke-pink-deep" />
        <path d="M82 58l-4 1" className="stroke-white" />
        <path d="M40 62l4-1" className="stroke-pink-deep" />
        <path d="M58 36l1 4" className="stroke-white" />
      </g>
    </Art>
  );
}
