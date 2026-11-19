"use client";

import * as React from "react";
import { SPLASH_COOKIE } from "@/lib/splash";

export interface SplashScreenProps {
  brandName: string;
  tagline: string;
}

/**
 * The loading screen from the design: sky, hills, the wordmark, a bar that
 * fills. It plays over the first customer page opened in a session.
 *
 * The public layout decides whether to render it, from the cookie, so a
 * returning visitor's HTML never contains it and there is nothing to flash.
 * Once rendered it leaves by itself — the fade is a CSS animation in
 * `kingdom.css`, which is what keeps a visitor without JavaScript from being
 * stuck behind it. This component adds only what CSS cannot: a tap to skip,
 * the session cookie, and taking the node out of the tree afterwards.
 *
 * It is decoration over a page that is already there, so it is `aria-hidden`
 * and never takes focus: a screen reader starts on the page itself.
 */
export function SplashScreen({ brandName, tagline }: SplashScreenProps) {
  const [state, setState] = React.useState<"playing" | "leaving" | "gone">("playing");

  React.useEffect(() => {
    // A session cookie: no Max-Age, so it lasts until the browser closes.
    document.cookie = `${SPLASH_COOKIE}=1; Path=/; SameSite=Lax`;
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
    </div>
  );
}
