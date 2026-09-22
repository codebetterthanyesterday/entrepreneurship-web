"use client";

import * as React from "react";
import { useAccent } from "@/components/site/accent-root";

/**
 * The header's mood switch: two overlapping dots, the current mood in front.
 *
 * It is how a customer changes the answer they gave on their first visit — a
 * wrong tap, or a phone passed across the table. Tapping it spills the other
 * mood across the page from the button itself.
 */
export function AccentSwitch() {
  const { accent, choose } = useAccent();
  const next = accent === "pink" ? "blue" : "pink";
  const label = `Ganti ke nuansa ${next === "blue" ? "biru" : "pink"}`;

  const front = accent === "pink" ? "bg-mood-pink" : "bg-mood-blue";
  const back = accent === "pink" ? "bg-mood-blue" : "bg-mood-pink";

  return (
    <button
      type="button"
      onClick={(event) => choose(next, event.currentTarget)}
      aria-label={label}
      title={label}
      className="group grid h-11 w-11 flex-none place-items-center rounded-full transition-colors hover:bg-pink-soft"
    >
      <span aria-hidden="true" className="relative block h-5 w-7">
        <span
          className={`absolute right-0 top-0.5 h-4 w-4 rounded-full ${back} opacity-80 ring-2 ring-white transition-transform duration-300 group-hover:translate-x-0.5`}
        />
        <span
          className={`absolute left-0 top-0.5 h-4 w-4 rounded-full ${front} ring-2 ring-white shadow-[0_2px_6px_-1px_rgb(0_0_0/0.25)] transition-transform duration-300 group-hover:-translate-x-0.5 group-hover:scale-110`}
        />
      </span>
    </button>
  );
}
