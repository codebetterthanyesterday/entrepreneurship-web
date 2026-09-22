"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export interface AutoRefreshProps {
  /** How often to ask the server for fresh figures. */
  intervalMs: number;
}

/**
 * Re-runs the server component it sits inside, on an interval.
 *
 * `router.refresh()` rather than polling a JSON endpoint: every figure on this
 * dashboard is computed by `report.query.ts` on the server, and an endpoint
 * would mean a second copy of those aggregates plus a view model to serialise
 * them through. Refreshing the route re-runs the same queries and merges the
 * new markup in place, leaving client state and scroll position alone.
 *
 * The tab being hidden pauses it. A dashboard left open on a laptop in a bag
 * has no reason to keep a query running against the booth's database every
 * thirty seconds, and `visibilitychange` fires a refresh on the way back so
 * whoever returns to the tab is not reading stale numbers while they wait.
 */
export function AutoRefresh({ intervalMs }: AutoRefreshProps) {
  const router = useRouter();

  React.useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [intervalMs, router]);

  return null;
}
