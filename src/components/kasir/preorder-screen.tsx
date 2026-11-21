"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Note } from "@/components/ui/note";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";
import {
  confirmHandoverLocationAction,
  markAsPaidAction,
  rejectHandoverLocationAction,
  transitionOrderAction,
} from "@/actions/kasir.actions";
import {
  HANDOVER_LABEL,
  describeHandover,
  formatServiceDate,
  isHandoverLocation,
} from "@/lib/schedule";
import {
  PREORDER_FILTERS,
  PREORDER_STATUS,
  matchesPreorderSearch,
  preorderFromScan,
  resolvePreorderAction,
} from "@/lib/cashier-preorder";
import { QrScanner } from "./qr-scanner";
import { formatRupiah } from "@/lib/utils";
import type { CashierPreorder } from "@/types/order-view";
import { PaymentSheet, type PaymentSubmission } from "./payment-sheet";
import { CustomerChat } from "@/components/staff/customer-chat";
import { needsLocationNotice } from "@/lib/customer-chat";
import { OrderEditSheet, canEditOrder } from "@/components/staff/order-edit-sheet";
import type { BookableSchedule } from "@/lib/queries/schedule.query";

/**
 * The kitchen moves orders from its own screen, so this list would otherwise go
 * stale in front of a cashier who is not touching anything.
 *
 * Eight seconds, not fifteen: the Fase 8 checkpoint requires a status changed
 * in the kitchen to reach the counter within ten. An interval is a worst case,
 * not an average — a change landing just after a refresh waits the whole
 * interval — so fifteen was measured at 13.2s and missed the bar.
 */
const REFRESH_INTERVAL_MS = 8_000;

const PAYMENT_LABEL = {
  CASH: "Bayar di tempat",
  QRIS: "QRIS",
} as const;

export interface PreorderScreenProps {
  preorders: CashierPreorder[];
  qrisImageUrl: string | null;
  /** The name messages to customers are signed with. */
  brand: string;
  /** Every open date from today on, for moving a preorder (`OrderEditSheet`). */
  schedule: BookableSchedule;
  /** An order to open on arrival, by number: a link from the inbox. */
  openOrderNumber?: string | null;
}

/** A preorder as the chat templates read it. */
const chatView = (order: CashierPreorder) => ({ ...order, hasPaymentProof: order.paymentProofUrl !== null });

export function PreorderScreen({ preorders, qrisImageUrl, brand, schedule, openOrderNumber }: PreorderScreenProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [search, setSearch] = React.useState("");
  const [filterKey, setFilterKey] = React.useState(PREORDER_FILTERS[0]!.key);
  /**
   * "ALL", one service date, or "REVIEW" for "Lainnya" orders with something
   * left to do: a location to check, or a customer to tell how it went.
   */
  const [dateKey, setDateKey] = React.useState<string>("ALL");
  const [rejectReason, setRejectReason] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(
    () => preorders.find((order) => order.orderNumber === openOrderNumber)?.id ?? null,
  );
  const [payOpen, setPayOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [scanOpen, setScanOpen] = React.useState(false);
  const [isWorking, setIsWorking] = React.useState(false);

  React.useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  // Looked up by id rather than held in state, so a refresh — or the cashier's
  // own action — redraws the open sheet with the order's new status instead of
  // leaving a stale copy on screen. An order that disappears closes the sheet.
  const selected = preorders.find((order) => order.id === selectedId) ?? null;

  const activeFilter =
    PREORDER_FILTERS.find((filter) => filter.key === filterKey) ?? PREORDER_FILTERS[0]!;

  // Narrowed here rather than on the server: the whole list is already in hand,
  // and the counter needs the list to settle as the cashier types, not one
  // round trip later.
  const dates = [...new Set(preorders.map((order) => order.serviceDate).filter(Boolean) as string[])].sort();
  const needsReview = (order: CashierPreorder) =>
    order.awaitingLocationCheck || needsLocationNotice(chatView(order));
  const awaiting = preorders.filter(needsReview).length;

  const visible = preorders.filter(
    (order) =>
      (activeFilter.statuses.length === 0 || activeFilter.statuses.includes(order.status)) &&
      (dateKey === "ALL" ||
        (dateKey === "REVIEW" ? needsReview(order) : order.serviceDate === dateKey)) &&
      matchesPreorderSearch(order, search),
  );

  // What to bring on the chosen day, place by place: the counter's packing list.
  const packing =
    dateKey !== "ALL" && dateKey !== "REVIEW"
      ? packingList(visible.filter((order) => order.status !== "CANCELLED"))
      : null;

  const closePayment = React.useCallback(() => setPayOpen(false), []);

  /**
   * Settles the bill. The sheet stays open afterwards: the order has only been
   * paid for, not handed over, and its next action — kitchen or counter — is
   * the very next thing the cashier needs.
   */
  const takePayment = React.useCallback(
    async (payment: PaymentSubmission) => {
      if (!selected) {
        return { ok: false as const, error: "Pesanannya nggak ketemu" };
      }

      const result = await markAsPaidAction({
        orderId: selected.id,
        cashReceived: payment.cashReceived,
      });

      if (result.ok) {
        setPayOpen(false);
        toast(`Pembayaran ${result.data.orderNumber} diterima`);
      }

      return result;
    },
    [selected, toast],
  );

  const runTransition = async (to: "IN_QUEUE" | "DONE") => {
    if (!selected || isWorking) return;

    setIsWorking(true);
    const result = await transitionOrderAction({ orderId: selected.id, to });
    setIsWorking(false);

    if (!result.ok) {
      toast(result.error);
      return;
    }

    toast(
      to === "IN_QUEUE"
        ? `${result.data.orderNumber} dikirim ke dapur`
        : `${result.data.orderNumber} sudah diserahkan`,
    );
    setSelectedId(null);
  };

  const reviewLocation = async (accept: boolean) => {
    if (!selected || isWorking) return;
    setIsWorking(true);
    const result = accept
      ? await confirmHandoverLocationAction(selected.id)
      : await rejectHandoverLocationAction({ orderId: selected.id, reason: rejectReason.trim() || null });
    setIsWorking(false);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    // The sheet stays open either way: the customer is told next, from the
    // chat templates that now lead it.
    toast(
      accept
        ? `Lokasi ${result.data.orderNumber} diterima. Kabari pelanggannya ya`
        : `${result.data.orderNumber} dibatalkan, stoknya kembali. Kabari pelanggannya ya`,
    );
    setRejectReason("");
    router.refresh();
  };

  const action = selected ? resolvePreorderAction(selected) : null;

  const closeScanner = React.useCallback(() => setScanOpen(false), []);

  /**
   * A ticket's QR opens that order's sheet straight away, whatever the list is
   * filtered to: the customer at the counter is the order to deal with.
   */
  const handleScan = React.useCallback(
    (text: string) => {
      const result = preorderFromScan(text, preorders);
      if (result.kind === "message") return result.message;
      navigator.vibrate?.(60);
      setScanOpen(false);
      setSelectedId(result.order.id);
      toast(`${result.order.orderNumber} dibuka`);
      return null;
    },
    [preorders, toast],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari nomor pesanan atau nama pelanggan"
          aria-label="Cari nomor pesanan atau nama pelanggan"
          className="ui-field min-w-0 flex-1 bg-white border-[1.5px] border-line rounded-[14px] min-h-[50px] px-4 text-ink text-[16px] placeholder:text-ink-soft/60 transition-colors focus:border-pink"
        />
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          className="flex min-h-[50px] flex-none items-center gap-2 rounded-[14px] bg-pink-deep px-4 text-[14px] font-semibold text-white transition hover:brightness-95"
        >
          <ScanGlyph />
          Scan QR
        </button>
      </div>

      <QrScanner open={scanOpen} onClose={closeScanner} onScan={handleScan} />

      <div className="flex gap-2 overflow-x-auto pt-1 pb-2.5 -mx-3.5 px-3.5 [scrollbar-width:none] tablet:mx-0 tablet:px-0 tablet:flex-wrap">
        {PREORDER_FILTERS.map((filter) => (
          <Chip
            key={filter.key}
            active={filter.key === activeFilter.key}
            aria-pressed={filter.key === activeFilter.key}
            onClick={() => setFilterKey(filter.key)}
            className="flex-none"
          >
            {filter.label}
          </Chip>
        ))}
      </div>

      {(dates.length > 0 || awaiting > 0) && (
        <div
          role="group"
          aria-label="Tanggal serah terima"
          className="flex gap-2 overflow-x-auto pb-2.5 -mx-3.5 px-3.5 [scrollbar-width:none] tablet:mx-0 tablet:px-0 tablet:flex-wrap"
        >
          <Chip active={dateKey === "ALL"} aria-pressed={dateKey === "ALL"} onClick={() => setDateKey("ALL")} className="flex-none">
            Semua tanggal
          </Chip>
          {dates.map((date) => (
            <Chip key={date} active={dateKey === date} aria-pressed={dateKey === date} onClick={() => setDateKey(date)} className="flex-none">
              {formatServiceDate(date).replace(/ \d{4}$/, "")}
            </Chip>
          ))}
          {awaiting > 0 && (
            <Chip active={dateKey === "REVIEW"} aria-pressed={dateKey === "REVIEW"} onClick={() => setDateKey("REVIEW")} className="flex-none">
              Lokasi Lainnya ({awaiting})
            </Chip>
          )}
        </div>
      )}

      {packing && packing.length > 0 && (
        <section aria-label="Yang harus dibawa" className="s-slab p-3.5">
          <p className="s-eyebrow">Yang harus dibawa · {formatServiceDate(dateKey)}</p>
          <ul className="mt-2 flex flex-col gap-2.5">
            {packing.map((group) => (
              <li key={group.location}>
                <p className="text-sm font-bold text-ink">
                  {group.label} · {group.orders} pesanan
                </p>
                <p className="text-[13px] text-ink-soft">
                  {group.items.map((item) => `${item.quantity}× ${item.name}`).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {visible.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="Nggak ada pesanan yang cocok"
          description="Coba kata kunci lain, atau ganti filternya ya."
        />
      ) : (
        <ul className="flex flex-col gap-3 desktop:grid desktop:grid-cols-2">
          {visible.map((order) => {
            const status = PREORDER_STATUS[order.status];

            return (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(order.id)}
                  className="s-slab w-full flex items-center gap-3.5 text-left p-3.5 transition-transform hover:-translate-y-0.5"
                >
                  {/* Just the digits: the cashier is matching what the customer
                      reads off their phone, and the "PO-" is on every one. */}
                  <span className="s-big-no flex-none min-w-[2.2ch] text-[26px] tabular-nums">
                    {order.orderNumber.split("-").at(-1)}
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-extrabold text-ink truncate">
                      {order.customerName}
                    </span>
                    <span className="block text-[12.5px] text-ink-soft truncate">
                      {order.serviceDate
                        ? `${formatServiceDate(order.serviceDate).replace(/ \d{4}$/, "")} ${order.pickupSlot ?? ""} · ${
                            isHandoverLocation(order.handoverLocation) ? HANDOVER_LABEL[order.handoverLocation] : ""
                          } · `
                        : order.pickupSlot
                          ? `ambil ${order.pickupSlot} · `
                          : ""}
                      {order.itemCount} item · {formatRupiah(order.totalAmount)}
                      {order.paymentStatus === "UNPAID" &&
                        (order.paymentMethod === "QRIS" && order.paymentProofUrl ? (
                          // A proof waiting to be checked against the merchant app.
                          <span className="text-sky-deep font-semibold"> · bukti QRIS masuk, cek</span>
                        ) : (
                          <span className="text-hot font-semibold"> · belum bayar</span>
                        ))}
                      {needsLocationNotice(chatView(order)) && (
                        <span className="text-warn font-semibold"> · belum dikabari</span>
                      )}
                    </span>
                  </span>

                  <Badge variant={status.variant} className="flex-none normal-case tracking-normal">
                    {status.label}
                  </Badge>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Never both at once: the payment sheet replaces the detail sheet rather
          than stacking on top of it, and settling the bill puts the detail
          sheet back — now showing the order's next action. */}
      {selected && action && !payOpen && !editOpen && (
        <Sheet
          open
          onClose={() => setSelectedId(null)}
          ariaLabel={`Pesanan ${selected.orderNumber}`}
        >
          <div className="flex flex-col gap-3 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="s-eyebrow">
                  Nomor pesanan
                </div>
                <h2 className="s-big-no text-[34px]">
                  {selected.orderNumber}
                </h2>
              </div>

              <Badge
                variant={PREORDER_STATUS[selected.status].variant}
                className="flex-none normal-case tracking-normal mt-1"
              >
                {PREORDER_STATUS[selected.status].label}
              </Badge>
            </div>

            <p className="text-sm text-ink-soft -mt-1">
              {selected.customerName} · {PAYMENT_LABEL[selected.paymentMethod]}
            </p>
            {selected.pickupSlot && (
              <p className="text-sm font-semibold text-ink -mt-2">{describeHandover(selected)}</p>
            )}

            <ul className="bg-sand rounded-[10px] p-3 flex flex-col gap-2">
              {selected.items.map((item, index) => (
                <li key={`${item.name}-${index}`} className="flex justify-between gap-3 text-sm">
                  <span className="text-ink">
                    {item.quantity}&times; {item.name}
                    {item.needsPrep && (
                      <Badge variant="prep" className="ml-1.5 align-middle">
                        racik
                      </Badge>
                    )}
                    {/* A paket is handed over as its contents, so the cashier
                        needs to see what goes in the bag. */}
                    {item.contents && (
                      <span className="block text-xs text-ink-soft">Isi: {item.contents}</span>
                    )}
                  </span>
                  <span className="flex-none text-ink-soft tabular-nums">
                    {formatRupiah(item.subtotal)}
                  </span>
                </li>
              ))}

              <li className="flex justify-between gap-3 border-t-2 border-dashed border-sand-line pt-2 mt-1 font-extrabold text-ink">
                <span>Total</span>
                <span className="tabular-nums">{formatRupiah(selected.totalAmount)}</span>
              </li>
            </ul>

            {selected.notes && (
              // Warn, not muted: a note the cashier skims past is a customer
              // handed the wrong thing.
              <Note variant="warn">
                <span className="block text-[11px] uppercase tracking-wider mb-0.5">
                  Catatan pelanggan
                </span>
                {selected.notes}
              </Note>
            )}

            {selected.paymentStatus === "UNPAID" && (
              <Note variant="hot">
                {selected.paymentMethod === "QRIS" && !selected.paymentProofUrl
                  ? "Belum ada bukti bayar QRIS. Pesanan baru bisa diproses setelah pelanggan bayar dan unggah buktinya; ingatkan lewat chat di bawah."
                  : "Pesanan ini belum dibayar. Terima pembayaran dulu sebelum diserahkan."}
              </Note>
            )}

            {selected.paymentMethod === "QRIS" && selected.paymentProofUrl && (
              <div className="flex flex-col gap-1.5">
                <span className="s-eyebrow">
                  Bukti bayar QRIS dari pelanggan
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.paymentProofUrl}
                  alt={`Bukti bayar QRIS pesanan ${selected.orderNumber}`}
                  className="w-full max-h-[280px] object-contain border-4 border-ink-deep bg-white"
                />
              </div>
            )}

            {selected.awaitingLocationCheck ? (
              <div className="flex flex-col gap-2">
                <Note variant="warn">
                  Lokasi &ldquo;Lainnya&rdquo;: cek dulu jangkauannya. Kalau tempatnya kurang jelas,
                  minta patokan lewat chat di bawah. Pesanan baru bisa diproses setelah lokasinya diterima.
                </Note>
                <Button variant="go" fullWidth isLoading={isWorking} onClick={() => reviewLocation(true)}>
                  Lokasi bisa, terima
                </Button>
                <input
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  maxLength={150}
                  placeholder="Alasan (opsional), misal: terlalu jauh"
                  aria-label="Alasan menolak lokasi"
                  className="ui-field bg-white border-[1.5px] border-line rounded-[12px] min-h-[46px] px-3 text-ink text-[15px]"
                />
                <Button variant="flat" fullWidth disabled={isWorking} onClick={() => reviewLocation(false)}>
                  Di luar jangkauan, batalkan
                </Button>
              </div>
            ) : action.kind === "BLOCKED" ? (
              <Button variant="flat" fullWidth disabled>
                {action.label}
              </Button>
            ) : (
              <Button
                variant={action.variant}
                fullWidth
                isLoading={isWorking}
                aria-expanded={action.kind === "PAY" ? payOpen : undefined}
                onClick={() =>
                  action.kind === "PAY" ? setPayOpen(true) : runTransition(action.to)
                }
              >
                {action.label}
              </Button>
            )}

            <CustomerChat
              orderId={selected.id}
              order={chatView(selected)}
              brand={brand}
              className="border-t-2 border-dashed border-line pt-3 mt-1"
            />

            {canEditOrder(selected) && (
              <Button variant="ghost" size="sm" fullWidth onClick={() => setEditOpen(true)}>
                Ubah nama, nomor, atau jadwal
              </Button>
            )}
          </div>
        </Sheet>
      )}

      {selected && payOpen && (
        <PaymentSheet
          total={selected.totalAmount}
          qrisImageUrl={qrisImageUrl}
          fixedMethod={selected.paymentMethod}
          paymentProofUrl={selected.paymentMethod === "QRIS" ? selected.paymentProofUrl : null}
          title={`Pembayaran ${selected.orderNumber}`}
          submitLabels={{
            CASH: "Pembayaran diterima",
            QRIS: "QRIS masuk, tandai lunas",
          }}
          onClose={closePayment}
          onSubmit={takePayment}
        />
      )}

      {/* Replaces the detail sheet like the payment sheet does, and puts it
          back on close, now showing the corrected order. */}
      {selected && editOpen && (
        <OrderEditSheet
          order={{ ...selected, channel: "PREORDER" }}
          schedule={schedule}
          onClose={() => setEditOpen(false)}
          onSaved={(orderNumber) => {
            setEditOpen(false);
            toast(`Data ${orderNumber} udah diperbarui`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** The day's active orders grouped by place, with item totals: what to pack. */
function packingList(orders: CashierPreorder[]) {
  const groups = new Map<string, { location: string; label: string; orders: number; items: Map<string, number> }>();
  for (const order of orders) {
    const location = order.handoverLocation ?? "LAINNYA";
    const label = isHandoverLocation(location) ? HANDOVER_LABEL[location] : "Tanpa lokasi";
    const group = groups.get(location) ?? { location, label, orders: 0, items: new Map() };
    group.orders += 1;
    for (const item of order.items) {
      group.items.set(item.name, (group.items.get(item.name) ?? 0) + item.quantity);
    }
    groups.set(location, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    items: [...group.items.entries()].map(([name, quantity]) => ({ name, quantity })),
  }));
}

/** Four corners of a viewfinder around a square. */
function ScanGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 flex-none">
      <path
        d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="8.5" y="8.5" width="7" height="7" rx="1" fill="currentColor" />
    </svg>
  );
}
