"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useAccent } from "@/components/site/accent-root";

const HINT_MS = 6000;

/**
 * The header's mood switch, drawn as what it is: a switch.
 *
 * It used to be two overlapping dots, which nobody read as something to tap. A
 * pill with ♀ on one end and ♂ on the other, and the same glossy orb as the
 * welcome sliding between them, says "this flips" at a glance — and it names the
 * choice it changes, which two coloured dots never did.
 *
 * Right after the welcome is answered it points itself out once: the orb pulses
 * and a bubble says where the answer can be changed. Nothing is stored for
 * that — the welcome only ever runs once, so neither does the hint.
 */
export function AccentSwitch() {
  const { accent, choose, hint, dismissHint } = useAccent();
  const blue = accent === "blue";

  React.useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(dismissHint, HINT_MS);
    return () => window.clearTimeout(timer);
  }, [hint, dismissHint]);

  return (
    <div className="relative flex-none">
      <button
        type="button"
        role="switch"
        aria-checked={blue}
        aria-label="Nuansa biru"
        title="Ganti warna tampilan"
        onClick={(event) => {
          dismissHint();
          choose(blue ? "pink" : "blue", event.currentTarget);
        }}
        // 44px tall for the thumb; the pill inside is the part that is drawn.
        className="group flex min-h-[44px] items-center rounded-full px-0.5"
      >
        <span
          aria-hidden="true"
          className="relative block h-8 w-[4.25rem] rounded-full bg-pink-soft ring-1 ring-inset ring-line transition-colors group-hover:ring-pink"
        >
          <Glyph kind="female" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pink-deep" />
          <Glyph kind="male" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-pink-deep" />

          <span
            className={cn(
              "mood-knob mood-orb absolute left-1 top-1 grid h-6 w-6 place-items-center text-white",
              blue ? "translate-x-9 group-hover:translate-x-8" : "group-hover:translate-x-1",
              hint && "mood-knob-hint",
            )}
          >
            <Glyph kind={blue ? "male" : "female"} className="h-3 w-3" />
          </span>
        </span>
      </button>

      {hint && (
        <p
          role="status"
          className="mood-hint absolute right-0 top-[calc(100%+4px)] z-50 w-max max-w-[15rem] rounded-2xl bg-ink px-3.5 py-2.5 text-[12.5px] font-semibold leading-snug text-white shadow-[0_12px_28px_-10px_rgb(0_0_0/0.45)]"
        >
          <span
            aria-hidden="true"
            className="absolute -top-1 right-7 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-ink"
          />
          Bisa diganti di sini kapan aja
        </p>
      )}
    </div>
  );
}

/** ♀ and ♂, drawn to the same 12px grid and stroke as each other. */
function Glyph({ kind, className }: { kind: "female" | "male"; className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("h-3 w-3", className)}
    >
      {kind === "female" ? (
        <>
          <circle cx="6" cy="4.6" r="3.1" />
          <path d="M6 7.7v3.6M4.2 9.7h3.6" />
        </>
      ) : (
        <>
          <circle cx="5" cy="7" r="3.1" />
          <path d="M7.2 4.8l3.3-3.3M8 1.5h2.5V4" />
        </>
      )}
    </svg>
  );
}
