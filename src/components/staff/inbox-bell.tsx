"use client";

import Link from "next/link";
import { usePolling } from "@/hooks/use-polling";
import type { InboxResponse } from "@/app/api/staff/inbox/route";

/** Light enough to sit on every staff screen; `/inbox` itself polls faster. */
const REFRESH_MS = 30_000;

/**
 * The bell in the staff header: how many things need a person (the "Pantau"
 * ones are not counted), one tap from the inbox. Counted in the browser after
 * the page has drawn, so it never slows a staff screen down.
 */
export function InboxBell() {
  const { data } = usePolling<InboxResponse>("/api/staff/inbox", { intervalMs: REFRESH_MS });
  const count = data?.items.filter((item) => item.tone !== "watch").length ?? 0;

  return (
    <Link
      href="/inbox"
      className="s-bell"
      aria-label={count > 0 ? `Inbox, ${count} perlu ditangani` : "Inbox, semua beres"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path
          d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4h4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {count > 0 && (
        <span aria-hidden="true" className="s-bell-count tabular-nums">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
