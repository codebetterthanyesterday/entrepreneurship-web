"use client";

import * as React from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Whether this browser should animate the reveal at all.
 *
 * Read through `useSyncExternalStore`, the same way the cart reads localStorage:
 * it keeps the server render and the first client render in agreement, and it
 * picks up a reader who changes the preference mid-session. The server answers
 * `true` — animate — because that is what the stylesheet assumes, and a browser
 * that wants less motion corrects it on its very first client render.
 */
function subscribeMotion(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};

  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);

  return () => query.removeEventListener("change", onChange);
}

function getMotionSnapshot(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  if (!("IntersectionObserver" in window)) return false;

  return !window.matchMedia(REDUCED_MOTION).matches;
}

function getMotionServerSnapshot(): boolean {
  return true;
}

export interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Staggers siblings. Kept small — a long cascade reads as a slideshow. */
  delayMs?: number;
  as?: "div" | "section" | "li" | "ul";
}

/**
 * Reveals its children as they scroll into view.
 *
 * One observer per element, disconnected the moment it has fired — this is a
 * one-way transition, and leaving observers attached to a page someone scrolls up
 * and down costs work for nothing.
 *
 * The animation is decoration; the content is not. So there are three ways back
 * to plain visible content: a reader who asked for less motion, or a browser
 * without IntersectionObserver, is marked revealed from the first render; and the
 * page ships a `<noscript>` rule for the case where none of this code runs.
 */
export function Reveal({ children, className, delayMs = 0, as = "div" }: RevealProps) {
  const Tag = as;
  const ref = React.useRef<HTMLElement | null>(null);

  const animate = React.useSyncExternalStore(
    subscribeMotion,
    getMotionSnapshot,
    getMotionServerSnapshot,
  );
  const [seen, setSeen] = React.useState(false);

  // Not animating means already arrived, so nothing is ever left hidden.
  const revealed = !animate || seen;

  React.useEffect(() => {
    if (!animate) return;

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setSeen(true);
          observer.disconnect();
        }
      },
      // Fires a little before the element's top edge arrives, so the movement has
      // finished by the time it is properly in view rather than starting then.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [animate]);

  return (
    <Tag
      // @ts-expect-error — one ref for a union of element tags; every branch is
      // an HTMLElement, which is all the observer needs.
      ref={ref}
      data-reveal=""
      data-revealed={revealed ? "true" : "false"}
      style={delayMs ? ({ "--reveal-delay": `${delayMs}ms` } as React.CSSProperties) : undefined}
      className={className}
    >
      {children}
    </Tag>
  );
}

/**
 * Unhides every revealable element when JavaScript never runs.
 *
 * Rendered once per page that uses `Reveal`. Without it, a visitor with scripts
 * blocked gets a page of invisible sections.
 */
export function RevealNoScript() {
  return (
    <noscript>
      <style
        dangerouslySetInnerHTML={{
          __html: "[data-reveal]{opacity:1 !important;transform:none !important}",
        }}
      />
    </noscript>
  );
}

/** Convenience for a row of items that should arrive one after another. */
export function revealDelay(index: number, step = 70, max = 280): number {
  return Math.min(index * step, max);
}
