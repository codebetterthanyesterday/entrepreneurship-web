"use client";

import * as React from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/use-toast";
import { transitionFromKitchenAction } from "@/actions/kitchen.actions";
import { usePolling } from "@/hooks/use-polling";
import { TIMER_TICK_MS } from "@/lib/kitchen-timer";
import { cn } from "@/lib/utils";
import type { KitchenQueueResponse, KitchenStatus, KitchenTicket } from "@/types/order-view";
import { TicketCard, type TicketTarget } from "./ticket-card";

interface BoardColumn {
  status: KitchenStatus;
  label: string;
  /** Each column gets its own colour so a glance across the board reads. */
  accent: string;
  emoji: string;
  empty: string;
}

const COLUMNS: readonly BoardColumn[] = [
  {
    status: "IN_QUEUE",
    label: "Antrian masuk",
    accent: "text-sky-deep",
    emoji: "😌",
    empty: "Antrian kosong. Santai dulu sebentar.",
  },
  {
    status: "IN_PROGRESS",
    label: "Lagi diracik",
    accent: "text-warn",
    emoji: "🍳",
    empty: "Belum ada yang diracik. Ambil dari antrian ya.",
  },
  {
    status: "READY",
    label: "Siap diambil",
    accent: "text-ok",
    emoji: "🎉",
    empty: "Belum ada yang siap. Semangat!",
  },
];

/**
 * A clock that ticks on its own, deliberately separate from the data polling.
 *
 * The wait timers have to keep counting even if the network is down — the
 * minutes are computed from a timestamp already on screen, so there is no
 * reason for a dead connection to freeze them too.
 */
function useNow(intervalMs: number): number {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

/**
 * The board as it would look once `to` has been applied — used to move a card
 * the instant it is tapped, before the server has answered.
 *
 * A ticket moved to DONE leaves the board entirely, which is exactly what
 * "Sudah diserahkan" means.
 */
function withTicketMoved(
  queue: KitchenQueueResponse,
  ticketId: string,
  to: TicketTarget,
): KitchenQueueResponse {
  if (to === "DONE") {
    return { tickets: queue.tickets.filter((ticket) => ticket.id !== ticketId) };
  }

  return {
    tickets: queue.tickets.map((ticket) =>
      ticket.id === ticketId ? { ...ticket, status: to } : ticket,
    ),
  };
}

export interface KitchenBoardProps {
  /** Rendered on the server so the board is never blank on first paint. */
  initialTickets: KitchenTicket[];
  /** False for a role that may read the board but not walk its transitions. */
  canAct: boolean;
}

export function KitchenBoard({ initialTickets, canAct }: KitchenBoardProps) {
  const { toast } = useToast();
  const now = useNow(TIMER_TICK_MS);

  const { data, isError, mutate } = usePolling<KitchenQueueResponse>("/api/kitchen", {
    fallbackData: { tickets: initialTickets },
  });

  const [activeStatus, setActiveStatus] = React.useState<KitchenStatus>("IN_QUEUE");
  const [pending, setPending] = React.useState<{ id: string; to: TicketTarget } | null>(null);

  const tickets = data?.tickets ?? [];

  const byStatus = (status: KitchenStatus) =>
    tickets.filter((ticket) => ticket.status === status);

  // What the kitchen still owes somebody. A ticket sitting in READY is done as
  // far as the cooking goes, so it is not part of this count.
  const outstanding = tickets.filter(
    (ticket) => ticket.status === "IN_QUEUE" || ticket.status === "IN_PROGRESS",
  ).length;

  const handleAction = async (ticket: KitchenTicket, to: TicketTarget) => {
    if (pending) return;

    setPending({ id: ticket.id, to });

    try {
      // The card moves column now, not when the server answers. SWR keeps the
      // pre-tap board and puts it back itself if the action throws, so a
      // refused move rewinds rather than leaving the screen lying.
      await mutate(
        async (current) => {
          const result = await transitionFromKitchenAction({ orderId: ticket.id, to });
          if (!result.ok) throw new Error(result.error);

          return withTicketMoved(current ?? { tickets }, ticket.id, to);
        },
        {
          optimisticData: (current) => withTicketMoved(current ?? { tickets }, ticket.id, to),
          rollbackOnError: true,
          // Confirm against the server straight away rather than waiting up to
          // five seconds for the next poll.
          revalidate: true,
        },
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Ada yang error nih, coba lagi ya");
    } finally {
      setPending(null);
    }
  };

  const renderColumnBody = (column: BoardColumn) => {
    const columnTickets = byStatus(column.status);

    if (columnTickets.length === 0) {
      return <EmptyState emoji={column.emoji} title={column.empty} className="py-10" />;
    }

    return (
      <ul className="flex flex-col gap-2.5">
        {columnTickets.map((ticket) => (
          <li key={ticket.id}>
            <TicketCard
              ticket={ticket}
              now={now}
              canAct={canAct}
              pendingTo={pending?.id === ticket.id ? pending.to : null}
              onAction={handleAction}
            />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {outstanding === 0 ? (
            "Nggak ada yang perlu dikerjain sekarang"
          ) : (
            <>
              <b className="text-ink">{outstanding} pesanan</b> nunggu dikerjain
            </>
          )}
        </p>

        <ConnectionIndicator isError={isError} />
      </div>

      {/* Mobile: one column at a time. Three columns on a narrow screen make
          every ticket too small to read across a kitchen counter. */}
      <div className="desktop:hidden flex flex-col gap-3">
        <nav className="flex gap-1.5" aria-label="Kolom dapur">
          {COLUMNS.map((column) => {
            const active = column.status === activeStatus;
            const count = byStatus(column.status).length;

            return (
              <button
                key={column.status}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => setActiveStatus(column.status)}
                className={cn(
                  "flex-1 min-h-[46px] rounded-[14px] flex items-center justify-center gap-1.5 px-2 text-[13px] font-bold transition-colors",
                  active ? "bg-pink-deep text-white" : "bg-white text-ink-soft hover:bg-pink-soft",
                )}
              >
                <span className="truncate">{column.label}</span>
                <span
                  className={cn(
                    "flex-none text-[11px] px-1.5 py-0.5 rounded-full",
                    active ? "bg-white/30 text-white" : "bg-cream text-ink-soft",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>

        {COLUMNS.filter((column) => column.status === activeStatus).map((column) => (
          <section key={column.status} aria-label={column.label}>
            {renderColumnBody(column)}
          </section>
        ))}
      </div>

      {/* Desktop: the whole board at once. */}
      <div className="hidden desktop:grid grid-cols-3 gap-4 items-start">
        {COLUMNS.map((column) => (
          <section
            key={column.status}
            aria-label={column.label}
            className="bg-white border-[1.5px] border-line rounded-[18px] p-3.5"
          >
            <h2
              className={cn(
                "font-[family-name:var(--font-display)] text-lg font-semibold mb-3 flex items-baseline justify-between gap-2",
                column.accent,
              )}
            >
              {column.label}
              <span className="text-[13px] tabular-nums">{byStatus(column.status).length}</span>
            </h2>

            {renderColumnBody(column)}
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * Says whether what is on screen is current. It reports a failed poll rather
 * than hiding it, because the board deliberately keeps showing the last good
 * queue — without this, stale data would be indistinguishable from fresh.
 */
function ConnectionIndicator({ isError }: { isError: boolean }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "flex-none inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full",
        isError ? "bg-hot-soft text-hot" : "bg-ok-soft text-ok",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("w-2 h-2 rounded-full", isError ? "bg-hot" : "bg-ok")}
      />
      {isError ? "Koneksi putus, data mungkin basi" : "Tersambung"}
    </span>
  );
}
