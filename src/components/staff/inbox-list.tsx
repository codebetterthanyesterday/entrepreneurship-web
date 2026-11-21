"use client";

import * as React from "react";
import Link from "next/link";
import { usePolling } from "@/hooks/use-polling";
import { useInboxDevice } from "@/hooks/use-inbox-device";
import type { InboxItem, InboxTone } from "@/lib/inbox";
import {
  SNOOZE_MINUTES,
  isNew,
  isSnoozed,
  markOpened,
  pruneSnoozes,
  snooze,
  unsnooze,
  updateInboxDevice,
} from "@/lib/inbox-device";
import { buzz, playChime, unlockChime } from "@/lib/inbox-chime";
import type { InboxResponse } from "@/app/api/staff/inbox/route";
import { Switch } from "@/components/ui/switch";
import { PushSetting } from "./push-setting";
import { useToast } from "@/components/ui/use-toast";
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
 *
 * Phase 2, all on this phone: "Baru" on what happened since the inbox was
 * last opened here, "Pantau" items put off for an hour, and a chime for new
 * work that the person turns on for themselves.
 */
export function InboxList({ initial }: { initial: InboxItem[] }) {
  const { data, isError, refresh } = usePolling<InboxResponse>("/api/staff/inbox", {
    fallbackData: { items: initial },
    intervalMs: REFRESH_MS,
  });
  const items = data?.items ?? initial;
  const device = useInboxDevice();
  // The clock "3 menit lalu" and the snoozes count against, moved every half minute.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Opening the inbox is what "Baru" counts from next time.
  React.useEffect(() => {
    const opened = Date.now();
    updateInboxDevice((state) => pruneSnoozes(markOpened(state, opened), opened));
  }, []);

  const todo = items.filter((item) => item.tone !== "watch");
  const watch = items.filter((item) => item.tone === "watch" && !isSnoozed(device, item.key, now));
  const putOff = items.filter((item) => item.tone === "watch" && isSnoozed(device, item.key, now));

  React.useEffect(() => {
    document.title = todo.length > 0 ? `(${todo.length}) Inbox · Bunnyè` : "Inbox · Bunnyè";
  }, [todo.length]);

  const { toast } = useToast();
  // "Saya yang tangani" and letting go: the server has the last word (a
  // colleague may have taken it a second earlier), then the list catches up.
  const setClaim = async (item: InboxItem, take: boolean) => {
    const response = await fetch("/api/staff/inbox/claim", {
      method: take ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: item.key }),
    }).catch(() => null);
    const result = (await response?.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!result?.ok) toast(result?.error ?? "Gagal, cek sinyal lalu coba lagi");
    refresh();
  };

  const card = (item: InboxItem) => (
    <InboxCard
      item={item}
      now={now}
      fresh={isNew(item, device)}
      onSnooze={item.tone === "watch" ? () => updateInboxDevice((state) => snooze(state, item, Date.now())) : undefined}
      onClaim={item.tone === "watch" ? undefined : (take) => void setClaim(item, take)}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      {isError && (
        <p role="status" className="s-alert text-sm font-semibold">
          Koneksi lagi putus-putus; daftar ini mungkin belum yang terbaru.
        </p>
      )}

      <ChimeSetting on={device.alerts} />
      <PushSetting />

      {todo.length === 0 && watch.length === 0 ? (
        <div className="s-slab flex flex-col items-center gap-1 p-8 text-center">
          <span aria-hidden="true" className="text-3xl">
            ✓
          </span>
          <p className="font-extrabold text-ink">Semua beres</p>
          <p className="text-sm text-ink-soft">Nggak ada yang perlu ditangani sekarang. Halaman ini ngecek sendiri tiap 15 detik.</p>
        </div>
      ) : (
        <>
          <Group title="Perlu tindakan" count={todo.length} empty="Nggak ada yang perlu ditangani sekarang.">
            {todo.map(card)}
          </Group>
          {watch.length > 0 && (
            <Group title="Pantau" count={watch.length}>
              {watch.map(card)}
            </Group>
          )}
        </>
      )}

      {putOff.length > 0 && (
        <details className="s-slab p-3.5">
          <summary className="flex min-h-[44px] cursor-pointer items-center text-sm font-bold text-ink">
            Ditunda ({putOff.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {putOff.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 border-t border-line pt-2">
                <span className="min-w-0 text-sm text-ink-soft">
                  <b className="text-ink">{item.title}</b> · {item.detail}
                </span>
                <button
                  type="button"
                  onClick={() => updateInboxDevice((state) => unsnooze(state, item.key))}
                  className="ui-btn min-h-[44px] flex-none bg-white px-3 text-[11px] text-ink"
                >
                  Tampilkan lagi
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** The chime switch: per phone, off until turned on here. */
function ChimeSetting({ on }: { on: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 s-slab p-3.5">
      <span className="min-w-0">
        <span className="block text-sm font-bold text-ink">Bunyi &amp; getar</span>
        <span className="block text-[12.5px] text-ink-soft">
          Waktu ada yang baru perlu ditangani. Cuma di HP ini; layarnya harus tetap terbuka.
        </span>
      </span>
      <Switch
        checked={on}
        aria-label="Bunyi dan getar waktu ada yang baru"
        onCheckedChange={(checked) => {
          if (checked) {
            // The tap that turns it on is the one the browser needs to allow sound.
            unlockChime();
            playChime();
            buzz();
          }
          updateInboxDevice((state) => ({ ...state, alerts: checked }));
        }}
      />
    </div>
  );
}

function Group({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty?: string;
  children: React.ReactNode[];
}) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5">
      <h2 id={id} className="s-h2 flex items-baseline gap-2">
        {title}
        <span className="text-sm font-semibold text-ink-soft tabular-nums">{count}</span>
      </h2>
      {count === 0 && empty ? (
        <p className="text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {React.Children.map(children, (child) => (
            <li>{child}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InboxCard({
  item,
  now,
  fresh,
  onSnooze,
  onClaim,
}: {
  item: InboxItem;
  now: number;
  fresh: boolean;
  onSnooze?: () => void;
  /** `true` to say "Saya yang tangani", `false` to let go. */
  onClaim?: (take: boolean) => void;
}) {
  const tone = TONE[item.tone];
  const takenByOther = item.claim && !item.claim.mine;
  return (
    // The link stretches over the card (its ::after); the buttons sit above
    // it, so they act without opening it.
    <div
      className={cn(
        "s-slab relative flex min-h-[64px] items-center gap-3 border-l-[6px] p-3.5 transition-transform hover:-translate-y-0.5",
        tone.edge,
        takenByOther && "opacity-70",
      )}
    >
      <span aria-hidden="true" className={cn("h-2.5 w-2.5 flex-none rounded-full", tone.dot)} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <Link
            href={item.href}
            className="font-extrabold text-[15px] text-ink after:absolute after:inset-0 after:content-['']"
          >
            {item.title}
            <span className="sr-only">
              {" "}
              · {item.detail} · {tone.label}
              {fresh ? " · baru" : ""}
            </span>
          </Link>
          {fresh && (
            <span aria-hidden="true" className="k-tag k-tag-red k-tag-flat !text-[10px]">
              Baru
            </span>
          )}
          {item.tone !== "watch" && (
            <span className="text-xs font-semibold text-ink-soft">{timeAgo(item.since, now)}</span>
          )}
        </span>
        <span aria-hidden="true" className="mt-0.5 block text-[13px] leading-snug text-ink-soft">
          {item.detail}
        </span>
        {onClaim && (
          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px]">
            {item.claim?.mine ? (
              <>
                <span className="font-bold text-ok">Kamu yang tangani</span>
                <button
                  type="button"
                  onClick={() => onClaim(false)}
                  className="relative z-10 min-h-[44px] px-1 font-semibold text-ink-soft underline underline-offset-4"
                  aria-label={`Lepas ${item.title}`}
                >
                  Lepas
                </button>
              </>
            ) : item.claim ? (
              <span className="font-semibold text-ink-soft">
                Ditangani {item.claim.by} · {timeAgo(item.claim.at, now)}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onClaim(true)}
                className="ui-btn relative z-10 min-h-[44px] bg-white px-3 text-[11px] text-ink"
                aria-label={`Saya yang tangani: ${item.title}, ${item.detail}`}
              >
                Saya yang tangani
              </button>
            )}
          </span>
        )}
      </span>
      {onSnooze ? (
        <button
          type="button"
          onClick={onSnooze}
          className="ui-btn relative z-10 min-h-[44px] flex-none bg-white px-3 text-[11px] text-ink"
          aria-label={`Tunda ${item.title} selama ${SNOOZE_MINUTES / 60} jam`}
        >
          Tunda 1 jam
        </button>
      ) : (
        <span aria-hidden="true" className="ui-btn flex-none bg-white px-3 py-1.5 text-[11px] text-ink">
          {item.actionLabel}
        </span>
      )}
    </div>
  );
}
