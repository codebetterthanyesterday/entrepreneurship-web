"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import {
  ACCENT_CHANNEL,
  DEFAULT_ACCENT,
  accentCookie,
  parseAccent,
  type Accent,
} from "@/lib/accent";
import { AccentWelcome } from "@/components/site/accent-welcome";

interface AccentContextValue {
  accent: Accent;
  /**
   * Records a mood and repaints the page in it. With an `origin`, the new colour
   * spills outward from that element; without one it cross-fades.
   */
  choose: (next: Accent, origin?: Element | null) => void;
  /**
   * True for a few seconds after the welcome is answered: the header switch
   * points itself out, so the customer learns where the choice can be changed.
   */
  hint: boolean;
  dismissHint: () => void;
}

const AccentContext = React.createContext<AccentContextValue | null>(null);

export function useAccent(): AccentContextValue {
  const value = React.useContext(AccentContext);
  if (!value) throw new Error("useAccent must be used inside <AccentRoot>");
  return value;
}

/** Same trick as `Sheet`: true from the first client render, false on the server. */
const NEVER_CHANGES = () => () => {};
const onClient = () => true;
const onServer = () => false;

export interface AccentRootProps {
  /** The mood from the cookie, or `null` when the visitor has not answered. */
  initialAccent: Accent | null;
  /** Whether to ask. False for crawlers even when they have no cookie. */
  ask: boolean;
  brandName: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * The customer side's colour mood, and the question that sets it.
 *
 * The mood is an attribute, `data-accent`, which `globals.css` answers by
 * redefining the palette's variables. It goes in two places:
 *
 *   - this wrapper, server-rendered from the cookie, so the very first paint is
 *     already in the right colour — there is no pink flash before a blue page;
 *   - <html>, from a layout effect, so the body behind the page and anything
 *     portalled into it (the product sheet, the toast) follow as well.
 *
 * The <html> copy is removed when this unmounts. Only the public layout renders
 * `AccentRoot`, so walking from the storefront into /admin or /kasir in the same
 * tab puts the staff screens back in their own palette.
 */
export function AccentRoot({ initialAccent, ask, brandName, className, children }: AccentRootProps) {
  const [accent, setAccent] = React.useState<Accent>(initialAccent ?? DEFAULT_ACCENT);
  const [asking, setAsking] = React.useState(ask);
  const mounted = React.useSyncExternalStore(NEVER_CHANGES, onClient, onServer);
  const channelRef = React.useRef<BroadcastChannel | null>(null);
  // Mirrors `asking` for `choose`, which is memoised once and must not read a
  // stale copy of the state to tell an answer to the welcome from a later switch.
  const askingRef = React.useRef(ask);
  const [hint, setHint] = React.useState(false);

  // A layout effect, not a passive one: inside a view transition the new state
  // has to be on <html> before the browser takes its "after" snapshot.
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accent;
    return () => {
      delete root.dataset.accent;
    };
  }, [accent]);

  // A choice made in one tab repaints the others, and closes their question.
  React.useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(ACCENT_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      const next = parseAccent(typeof event.data === "string" ? event.data : null);
      if (!next) return;
      setAccent(next);
      askingRef.current = false;
      setAsking(false);
    };
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  const choose = React.useCallback((next: Accent, origin?: Element | null) => {
    document.cookie = accentCookie(next, window.location.protocol === "https:");
    channelRef.current?.postMessage(next);

    // Answering the welcome — skipping included — is the moment to show where
    // the answer lives from now on. A later change from the switch itself is not.
    const answeringWelcome = askingRef.current;
    askingRef.current = false;

    const apply = () =>
      flushSync(() => {
        setAccent(next);
        setAsking(false);
        if (answeringWelcome) setHint(true);
      });

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (typeof document.startViewTransition !== "function" || reduceMotion) {
      apply();
      return;
    }

    if (!origin) {
      document.startViewTransition(apply);
      return;
    }

    // The new page grows as a circle out of the middle of whatever was tapped,
    // until it reaches the farthest corner of the screen.
    const rect = origin.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const root = document.documentElement;
    root.dataset.accentReveal = "";
    const transition = document.startViewTransition(apply);

    transition.ready
      .then(() => {
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 780,
            easing: "cubic-bezier(0.65, 0, 0.35, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      // A transition the browser skips (the tab was hidden, say) still applied
      // the update; there is just nothing to animate.
      .catch(() => {});

    transition.finished.finally(() => {
      delete root.dataset.accentReveal;
    });
  }, []);

  const dismissHint = React.useCallback(() => setHint(false), []);
  const value = React.useMemo(
    () => ({ accent, choose, hint, dismissHint }),
    [accent, choose, hint, dismissHint],
  );

  return (
    <AccentContext value={value}>
      {/*
        The page goes inert behind the question — out of the tab order and out of
        reach of a screen reader — but only once hydrated. Server-rendered inert
        would leave a visitor without JavaScript stuck behind a question they
        cannot answer; the <noscript> rule in the welcome hides it instead.
      */}
      <div data-accent={accent} className={className} inert={asking && mounted}>
        {children}
      </div>

      {asking && <AccentWelcome brandName={brandName} onChoose={choose} />}
    </AccentContext>
  );
}
