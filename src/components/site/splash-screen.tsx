"use client";

import * as React from "react";
import { useSiteIdentity } from "./site-identity";

export interface SplashScreenProps {
  brandName: string;
  tagline: string;
}

/** Shown at least this long, so the scene reads instead of flashing. */
const MIN_SHOWN_MS = 900;

/**
 * The loading screen from the design: sky, hills, the wordmark, a bar. It
 * plays over every customer page opened afresh (a link, a reload, a new tab),
 * and its loading form (`SplashLoading`) covers the wait between pages, so
 * the customer meets the same screen whenever the shop is loading.
 *
 * It lasts as long as the page takes to be ready, within bounds: at least
 * 0.9 s, so it reads, and it leaves once the page has loaded; the fade in
 * `kingdom.css` caps it at about 2.7 s whatever happens, which is also what
 * keeps a visitor without JavaScript from being stuck behind it. A tap skips.
 *
 * It is decoration over a page that is already there, so it is `aria-hidden`
 * and never takes focus: a screen reader starts on the page itself.
 */
export function SplashScreen({ brandName, tagline }: SplashScreenProps) {
  const [state, setState] = React.useState<"playing" | "leaving" | "gone">("playing");

  React.useEffect(() => {
    const shownAt = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const leaveWhenRead = () => {
      const wait = Math.max(0, MIN_SHOWN_MS - (performance.now() - shownAt));
      timer = setTimeout(() => setState((now) => (now === "playing" ? "leaving" : now)), wait);
    };
    if (document.readyState === "complete") leaveWhenRead();
    else window.addEventListener("load", leaveWhenRead, { once: true });
    return () => {
      window.removeEventListener("load", leaveWhenRead);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (state === "gone") return null;

  return (
    <div
      aria-hidden="true"
      className="k-splash"
      data-leaving={state === "leaving"}
      onClick={() => setState("leaving")}
      onAnimationEnd={(event) => {
        // The bar's own animation ends first and bubbles up; only the
        // splash's fade means it is time to go.
        if (event.target === event.currentTarget) setState("gone");
      }}
    >
      <SplashScene brandName={brandName} tagline={tagline} />
    </div>
  );
}

/**
 * The splash in its loading form, for a route's `loading.tsx`: the same
 * scene while the next page is on its way, its bar running until that page
 * replaces it. It fades in after a beat (CSS), so a quick move between pages
 * shows nothing at all instead of a flash.
 */
export function SplashLoading({ label = "Lagi nyiapin halaman..." }: { label?: string }) {
  const { brandName, tagline } = useSiteIdentity();
  return (
    <div role="status" aria-label={label} className="k-splash k-splash-loading">
      <div aria-hidden="true" className="contents">
        <SplashScene brandName={brandName} tagline={tagline} />
      </div>
    </div>
  );
}

function SplashScene({ brandName, tagline }: SplashScreenProps) {
  return (
    <>
    <div className="k-splash-hud">
      <span>
        <b className="text-[var(--k-grass)]">●</b> <b className="text-[var(--k-red-deep)]">WORLD 0-0</b>{" "}
        SNACK KINGDOM<span className="k-splash-wide"> PORTAL</span>
      </span>
      <span className="k-splash-wide">
        <b className="text-[var(--k-grass)]">●</b> RADAR: ONLINE
      </span>
    </div>

    <div className="k-splash-blocks" style={{ top: "11%", left: "16%" }}>
      <i data-kind="crate" />
      <i data-kind="q" />
      <i data-kind="crate" />
    </div>
    <div className="k-splash-blocks" style={{ top: "21%", right: "14%" }}>
      <b />
      <i data-kind="q" />
      <i data-kind="crate" />
    </div>
    <div className="k-cloud" style={{ top: "34%", left: "2%" }} />
    <div className="k-cloud" style={{ top: "17%", right: "14%" }} />

    <div className="k-splash-mid">
      <div className="k-splash-ready">☆ PLAYER 01 — READY TO SNACK? ☆</div>
      <div className="k-splash-word">
        <i className="k-shroom" />
        <i className="k-shroom k-shroom-green" />
        {brandName}
      </div>
      <div className="k-splash-tagline">{tagline}</div>
    </div>

    <div className="k-splash-hills">
      <div className="k-splash-hill" data-side="left" style={{ left: "-18%", width: "60%" }} />
      <div className="k-splash-hill" data-side="right" style={{ right: "-20%", width: "62%" }} />
      <div
        className="k-splash-hill"
        style={{ left: "24%", width: "52%", transform: "translateY(56%)" }}
      />
    </div>

    <div className="k-splash-load">
      <p>PREPARING YOUR SNACK ADVENTURE...</p>
      <div className="k-splash-bar">
        <i />
      </div>
    </div>

    <div className="k-splash-strip" />
    <div className="k-splash-foot">
      <span>
        <b className="text-[var(--k-yellow)]">●</b> {brandName} SNACKS // PRE-ORDER SYSTEM
      </span>
      <span className="k-splash-wide">THANKS FOR VISITING THE SNACK KINGDOM!</span>
    </div>
    </>
  );
}
