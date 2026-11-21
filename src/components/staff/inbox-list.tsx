"use client";

import * as React from "react";
import Link from "next/link";
import { usePolling } from "@/hooks/use-polling";
import type { InboxItem, InboxTone } from "@/lib/inbox";
import type { InboxResponse } from "@/app/api/staff/inbox/route";
import { cn } from "@/lib/utils";

/** As often as a cashier would glance at it: new work shows within 15 s. */
const REFRESH_MS = 15_000;

const TONE: Readonly<Record<InboxTone, { label: string; dot: string; edge: string }>> = {
  urgent: { label: "Segera", dot: "bg-hot", edge: "border-l-hot" },
  action: { label: "Perlu tindakan", dot: "bg-warn", edge: "border-l-warn" },
  watch: { label: "Pantau", dot: "bg-[var(--k-yellow)]", edge: "border-l-[var(--k-yellow)]" },
};

/** "baru saja", "3 menit lalu", "2 jam lalu". */
export function timeAgo(since: string, now: number): string {
  const minutes = Math.floor((now - new Date(since).getTime()) / 60_000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  return `${Math.floor(minutes / 60)} jam lalu`;
}

/**
 * The inbox, kept fresh by polling: what needs doing first, what to keep an
 * eye on after. Each card is one link to the screen where it is dealt with;
 * nothing is acted on from here, so the checks those screens make still hold.
 * An item leaves on its own once its reason is gone.
 */
export function InboxList({ initial }: { initial: InboxItem[] }) {
  const { data, isError } = usePolling<InboxResponse>("/api/staff/inbox", {
    fallbackData: { items: initial },
    intervalMs: REFRESH_MS,
  });
  const items = data?.items ?? initial;
  // The clock "3 menit lalu" counts against, moved on every half minute.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const todo = items.filter((item) => item.tone !== "watch");
  const watch = items.filter((item) => item.tone === "watch");

  React.useEffect(() => {
    document.title = todo.length > 0 ? `(${todo.length}) Inbox · Bunnyè` : "Inbox · Bunnyè";
  }, [todo.length]);

  return (
    <div className="flex flex-col gap-6">
      {isError && (
        <p role="status" className="s-alert text-sm font-semibold">
          Koneksi lagi putus-putus; daftar ini mungkin belum yang terbaru.
        </p>
      )}

      {items.length === 0 ? (
        <div className="s-slab flex flex-col items-center gap-1 p-8 text-center">
          <span aria-hidden="true" className="text-3xl">
            ✓
          </span>
          <p className="font-extrabold text-ink">Semua beres</p>
          <p className="text-sm text-ink-soft">Nggak ada yang perlu ditangani sekarang. Halaman ini ngecek sendiri tiap 15 detik.</p>
        </div>
      ) : (
        <>
          <Group title="Perlu tindakan" items={todo} now={now} empty="Nggak ada yang perlu ditangani sekarang." />
          {watch.length > 0 && <Group title="Pantau" items={watch} now={now} />}
        </>
      )}
    </div>
  );
}

function Group({ title, items, now, empty }: { title: string; items: InboxItem[]; now: number; empty?: string }) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5">
      <h2 id={id} className="s-h2 flex items-baseline gap-2">
        {title}
        <span className="text-sm font-semibold text-ink-soft tabular-nums">{items.length}</span>
      </h2>
      {items.length === 0 && empty ? (
        <p className="text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((item) => (
            <li key={item.key}>
              <InboxCard item={item} now={now} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InboxCard({ item, now }: { item: InboxItem; now: number }) {
  const tone = TONE[item.tone];
  return (
    <Link
      href={item.href}
      className={cn(
        "s-slab flex min-h-[64px] items-center gap-3 border-l-[6px] p-3.5 transition-transform hover:-translate-y-0.5",
        tone.edge,
      )}
    >
      <span aria-hidden="true" className={cn("h-2.5 w-2.5 flex-none rounded-full", tone.dot)} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-extrabold text-[15px] text-ink">{item.title}</span>
          {item.tone !== "watch" && (
            <span className="text-xs font-semibold text-ink-soft">{timeAgo(item.since, now)}</span>
          )}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">{item.detail}</span>
        <span className="sr-only">{tone.label}</span>
      </span>
      <span className="ui-btn flex-none bg-white px-3 py-1.5 text-[11px] text-ink">{item.actionLabel}</span>
    </Link>
  );
}
