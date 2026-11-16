import * as React from "react";
import { cn } from "@/lib/utils";
import { Sparkle } from "./order-stage";

/**
 * The pictures for the cart and checkout headings, and the empty cart, drawn in
 * the same hand as the tracker's stage art
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
