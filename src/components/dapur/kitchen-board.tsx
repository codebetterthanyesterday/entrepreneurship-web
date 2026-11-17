"use client";

import * as React from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/use-toast";
import { transitionFromKitchenAction } from "@/actions/kitchen.actions";
import { usePolling } from "@/hooks/use-polling";
import { LATE_AFTER_MINUTES, TIMER_TICK_MS, minutesWaiting } from "@/lib/kitchen-timer";
import { cn } from "@/lib/utils";
import type { KitchenQueueResponse, KitchenStatus, KitchenTicket } from "@/types/order-view";
import { STATUS_COLOR, TicketCard, type TicketTarget } from "./ticket-card";

interface BoardColumn {
  status: KitchenStatus;
  label: string;
  emoji: string;
  empty: string;
}

const COLUMNS: readonly BoardColumn[] = [
  {
    status: "IN_QUEUE",
    label: "Antrian masuk",
    emoji: "😌",
    empty: "Antrian kosong. Santai dulu sebentar.",
  },
  {
    status: "IN_PROGRESS",
    label: "Lagi diracik",
    emoji: "🍳",
    empty: "Belum ada yang diracik. Ambil dari antrian ya.",
  },
  {
    status: "READY",
    label: "Siap diambil",
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
  const owed = tickets.filter(
    (ticket) => ticket.status === "IN_QUEUE" || ticket.status === "IN_PROGRESS",
  );
  const outstanding = owed.length;

  // The longest wait among those, so the head of the board says how far behind
  // the kitchen is without anyone scanning the timers.
  const oldest = owed.reduce((max, ticket) => Math.max(max, minutesWaiting(ticket, now)), 0);

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
      <ul className="flex flex-col gap-3">
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
      <div className="flex flex-wrap items-center gap-2">
        <p className="k-tag k-tag-soft">
          {outstanding === 0 ? (
            "Nggak ada yang perlu dikerjain sekarang"
          ) : (
            <>
              <b>{outstanding} pesanan</b> nunggu dikerjain
            </>
          )}
        </p>

        {oldest > 0 && (
          <p className={cn("k-tag", oldest >= LATE_AFTER_MINUTES ? "k-tag-red" : "k-tag-yellow")}>
            Terlama {oldest} mnt
          </p>
        )}

        <ConnectionIndicator isError={isError} />
      </div>

      {/* Mobile: one column at a time. Three columns on a narrow screen make
          every ticket too small to read across a kitchen counter. */}
      <div className="tablet:hidden flex flex-col gap-3">
        <nav className="grid grid-cols-3 gap-2" aria-label="Kolom dapur">
          {COLUMNS.map((column) => {
            const active = column.status === activeStatus;
            const count = byStatus(column.status).length;

            return (
              <button
                key={column.status}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => setActiveStatus(column.status)}
                // The column's colour on the tab's top edge; navy when it is open.
                className="s-coltab"
                style={{ "--col": STATUS_COLOR[column.status] } as React.CSSProperties}
              >
                <b className="tabular-nums">{count}</b>
                <span className="truncate max-w-full">{column.label}</span>
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
      <div className="hidden tablet:grid grid-cols-3 gap-3.5 desktop:gap-5 items-start">
        {COLUMNS.map((column) => (
          <section
            key={column.status}
            aria-label={column.label}
            className="s-panel s-col"
            style={{ "--col": STATUS_COLOR[column.status] } as React.CSSProperties}
          >
            <h2 className="flex items-center justify-between gap-2 px-1 pt-1 pb-2.5">
              <span className="s-h2 flex items-center gap-2 text-[16px]">
                <span aria-hidden="true" className="s-col-dot" />
                {column.label}
              </span>
              <span className="s-col-count tabular-nums">{byStatus(column.status).length}</span>
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
      className={cn("k-tag ml-auto", isError ? "bg-hot-soft text-hot" : "bg-ok-soft text-ok")}
    >
      <span
        aria-hidden="true"
        className={cn("w-2 h-2 rounded-full", isError ? "bg-hot" : "bg-ok")}
      />
      {isError ? "Koneksi putus, data mungkin basi" : "Tersambung"}
    </span>
  );
}
