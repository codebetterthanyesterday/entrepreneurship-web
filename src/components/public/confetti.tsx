"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const PIECES = 44;
const LIFETIME_MS = 3200;

/*
 * The mood's own colours plus white, so a blue-mood customer gets blue confetti.
 * Written out in full because Tailwind only generates classes it can see.
 */
const COLOURS = ["bg-pink", "bg-pink-soft", "bg-white", "bg-pink-deep", "bg-pink"] as const;

/** A small deterministic generator: the same burst draws the same way every time. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * A burst of confetti from the middle of its container, each time `fire` goes up.
 *
 * Plain elements and one CSS keyframe (`.confetti-piece`) — no canvas, no
 * library, nothing left running once it lands. Readers who asked for less
 * motion get no burst at all; the stage's own pop is celebration enough.
 */
export function Confetti({ fire, className }: { fire: number; className?: string }) {
  const [active, setActive] = React.useState(0);

  // Adjusting state while rendering, React's pattern for "reset when a prop
  // changes": no effect, no extra paint with stale pieces.
  const [seen, setSeen] = React.useState(fire);
  if (fire !== seen) {
    setSeen(fire);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (fire > 0 && !reduce) setActive(fire);
  }

  React.useEffect(() => {
    if (active === 0) return;
    const timer = window.setTimeout(() => setActive(0), LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  const pieces = React.useMemo(() => {
    if (active === 0) return [];
    const next = random(active * 7919);

    return Array.from({ length: PIECES }, (_, index) => {
      const angle = next() * Math.PI - Math.PI; // upward half
      const reach = 90 + next() * 190;
      const round = next() > 0.7;
      const width = round ? 8 : 6 + next() * 5;

      return {
        key: `${active}-${index}`,
        colour: COLOURS[index % COLOURS.length]!,
        style: {
          "--x": `${Math.cos(angle) * reach}px`,
          "--rise": `${Math.sin(angle) * reach * 0.9}px`,
          "--fall": `${160 + next() * 260}px`,
          "--spin": `${(next() - 0.5) * 1080}deg`,
          "--delay": `${Math.round(next() * 160)}ms`,
          "--duration": `${1900 + Math.round(next() * 1000)}ms`,
          "--w": `${width}px`,
          "--h": `${round ? 8 : 10 + next() * 6}px`,
          "--radius": round ? "9999px" : "2px",
        } as React.CSSProperties,
      };
    });
  }, [active]);

  if (pieces.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 z-10 overflow-hidden", className)}
    >
      {pieces.map((piece) => (
        <span key={piece.key} className={cn("confetti-piece", piece.colour)} style={piece.style} />
      ))}
    </div>
  );
}
