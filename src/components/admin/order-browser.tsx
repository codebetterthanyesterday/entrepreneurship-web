"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Note } from "@/components/ui/note";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";
import { cancelOrderAction } from "@/actions/admin.actions";
import { cn, formatRupiah } from "@/lib/utils";
import type { OrderStatus } from "@/types/order";
import type { AdminOrder } from "@/types/order-view";

/** Status names as staff say them, matching the dashboard and the kitchen. */
const STATUS_LABEL: Readonly<Record<OrderStatus, string>> = {
  CONFIRMED: "Belum diambil",
  IN_QUEUE: "Antrian dapur",
  IN_PROGRESS: "Lagi diracik",
  READY: "Siap diserahkan",
  DONE: "Selesai",
  CANCELLED: "Dibatalkan",
};

const STATUS_VARIANT: Readonly<
  Record<OrderStatus, "info" | "prep" | "ok" | "danger" | "muted">
> = {
  CONFIRMED: "info",
  IN_QUEUE: "info",
  IN_PROGRESS: "prep",
  READY: "ok",
  DONE: "muted",
  CANCELLED: "danger",
};

const CHANNEL_LABEL = { PREORDER: "Preorder", ONSITE: "Di tempat" } as const;
const PAYMENT_STATUS_LABEL = { PAID: "Lunas", UNPAID: "Belum bayar" } as const;

/** "20 Sep 2026, 13.45" in the event's timezone, wherever the reader is. */
const TIMESTAMP_FORMAT = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatTimestamp(iso: string): string {
  return TIMESTAMP_FORMAT.format(new Date(iso));
}

/** The stages of the detail sheet's trail, in the order they happen. */
const TIMELINE_ROWS = [
  { key: "createdAt", label: "Dibuat" },
  { key: "queuedAt", label: "Masuk antrian" },
  { key: "startedAt", label: "Mulai diracik" },
  { key: "readyAt", label: "Siap" },
  { key: "completedAt", label: "Selesai" },
] as const;

function OrderCard({ order, onSelect }: { order: AdminOrder; onSelect: () => void }) {
  // One compact line of items, so the card answers "what was in it" without
  // being opened.
  const itemSummary = order.items.map((item) => `${item.quantity}× ${item.name}`).join(", ");

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Lihat detail pesanan ${order.orderNumber}`}
      className={cn(
        "w-full text-left bg-white border-[1.5px] border-line rounded-[18px] p-3.5",
        "transition-colors hover:border-pink focus:border-pink",
        order.status === "CANCELLED" && "opacity-60",
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-[family-name:var(--font-display)] text-[15px] font-semibold text-ink">
            {order.orderNumber}
          </span>
          <span className="block text-[13px] font-semibold text-ink-soft truncate">
            {order.customerName} · {order.itemCount} item
          </span>
        </span>

        <span className="font-[family-name:var(--font-display)] text-[15px] text-ink flex-none tabular-nums">
          {formatRupiah(order.totalAmount)}
        </span>
      </span>

      <span className="flex gap-1.5 flex-wrap mt-2">
        <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
        <Badge variant="muted">{CHANNEL_LABEL[order.channel]}</Badge>
        {order.paymentStatus === "UNPAID" && order.status !== "CANCELLED" && (
          <Badge variant="danger">belum bayar</Badge>
        )}
      </span>

      {itemSummary && (
        <span className="block text-xs font-medium text-ink-soft truncate mt-1.5">
          {itemSummary}
        </span>
      )}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-dashed border-line last:border-b-0">
      <dt className="text-[13px] font-semibold text-ink-soft flex-none">{label}</dt>
      <dd className="text-[13px] font-semibold text-ink text-right min-w-0">{value}</dd>
    </div>
  );
}

export interface OrderBrowserProps {
  orders: readonly AdminOrder[];
}

/**
 * The order list, and the sheet behind each card.
 *
 * Filtering and pagination are not here — they are plain links handled by the
 * server, so the list works before this component has hydrated and a filtered
 * view can be bookmarked. This component owns the two things that genuinely
 * need the browser: opening a detail sheet, and cancelling.
 */
export function OrderBrowser({ orders }: OrderBrowserProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // Looked up by id rather than held as an object, so the sheet redraws itself
  // from the refreshed list after a cancellation instead of showing the row as
  // it was before.
  const selected = orders.find((order) => order.id === selectedId) ?? null;

  const closeSheet = () => {
    setSelectedId(null);
    setConfirmingCancel(false);
  };

  const runCancel = async () => {
    if (!selected) return;

    setIsCancelling(true);
    const result = await cancelOrderAction({ orderId: selected.id });
    setIsCancelling(false);

    if (!result.ok) {
      toast(result.error);
      return;
    }

    toast(`Pesanan ${result.data.orderNumber} dibatalin, stoknya udah balik`);
    setConfirmingCancel(false);
    // The list this sheet reads from is server-rendered, so it has to be pulled
    // again before the sheet can show the new status.
    router.refresh();
  };

  if (orders.length === 0) {
    return (
      <EmptyState
        emoji="🔎"
        title="Nggak ada pesanan di sini"
        description="Coba ganti filternya, atau tunggu pesanan pertama masuk."
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2.5 tablet:grid tablet:grid-cols-2 desktop:grid-cols-3">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onSelect={() => {
              setSelectedId(order.id);
              setConfirmingCancel(false);
            }}
          />
        ))}
      </div>

      <Sheet
        open={selected !== null}
        onClose={closeSheet}
        title={selected ? `Pesanan ${selected.orderNumber}` : undefined}
      >
        {selected && (
          <div className="flex flex-col gap-4 pb-4">
            <div className="flex gap-1.5 flex-wrap">
              <Badge variant={STATUS_VARIANT[selected.status]}>
                {STATUS_LABEL[selected.status]}
              </Badge>
              <Badge variant="muted">{CHANNEL_LABEL[selected.channel]}</Badge>
            </div>

            <section>
              <h3 className="text-sm font-semibold text-ink mb-1.5">Rincian pesanan</h3>
              <ul>
                {selected.items.map((item, index) => (
                  <li
                    key={`${item.name}-${index}`}
                    className="flex justify-between gap-3 py-1.5 border-b border-dashed border-line last:border-b-0"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-ink">
                        {item.quantity}× {item.name}
                      </span>
                      {/* The price charged at the time, not the menu's price today. */}
                      <span className="block text-xs font-medium text-ink-soft">
                        @ {formatRupiah(item.priceAtOrder)}
                      </span>
                    </span>
                    <span className="text-[13px] font-semibold text-ink flex-none tabular-nums">
                      {formatRupiah(item.subtotal)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex justify-between gap-3 pt-2.5 mt-1 border-t-[1.5px] border-line">
                <span className="text-sm font-semibold text-ink">Total</span>
                <span className="font-[family-name:var(--font-display)] text-lg text-pink-deep tabular-nums">
                  {formatRupiah(selected.totalAmount)}
                </span>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-ink mb-1.5">Data pesanan</h3>
              <dl>
                <DetailRow label="Pelanggan" value={selected.customerName} />
                {selected.customerPhone && (
                  <DetailRow label="WhatsApp" value={selected.customerPhone} />
                )}
                <DetailRow label="Bayar pakai" value={selected.paymentMethod} />
                <DetailRow
                  label="Status bayar"
                  value={PAYMENT_STATUS_LABEL[selected.paymentStatus]}
                />
                <DetailRow label="Slot ambil" value={selected.pickupSlot ?? "—"} />
                <DetailRow label="Ditangani" value={selected.handledByName ?? "—"} />
                <DetailRow label="Catatan" value={selected.notes ?? "—"} />
              </dl>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-ink mb-1.5">Jejak waktu</h3>
              <dl>
                {TIMELINE_ROWS.map((row) => {
                  const at = selected.timeline[row.key];
                  return (
                    <DetailRow
                      key={row.key}
                      label={row.label}
                      value={at ? formatTimestamp(at) : "—"}
                    />
                  );
                })}
              </dl>
            </section>

            {selected.canCancel && (
              <section className="flex flex-col gap-2.5">
                {confirmingCancel ? (
                  <>
                    <Note variant="hot">
                      Yakin mau batalin pesanan {selected.orderNumber}? Stok tiap menunya bakal
                      otomatis dibalikin ke sisa stok, dan slot ambilnya dilepas lagi.
                    </Note>
                    <div className="flex gap-2.5">
                      <Button
                        variant="flat"
                        size="sm"
                        fullWidth
                        onClick={() => setConfirmingCancel(false)}
                        disabled={isCancelling}
                      >
                        Nggak jadi
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        isLoading={isCancelling}
                        onClick={() => void runCancel()}
                      >
                        Ya, batalin
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth
                    onClick={() => setConfirmingCancel(true)}
                  >
                    Batalkan pesanan
                  </Button>
                )}
              </section>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
