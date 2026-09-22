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
import { markAsPaidAction, transitionOrderAction } from "@/actions/kasir.actions";
import {
  PREORDER_FILTERS,
  PREORDER_STATUS,
  matchesPreorderSearch,
  resolvePreorderAction,
} from "@/lib/cashier-preorder";
import { formatRupiah } from "@/lib/utils";
import type { CashierPreorder } from "@/types/order-view";
import { PaymentSheet, type PaymentSubmission } from "./payment-sheet";

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
  QRIS: "Transfer / QRIS",
} as const;

export interface PreorderScreenProps {
  preorders: CashierPreorder[];
  qrisImageUrl: string | null;
}

export function PreorderScreen({ preorders, qrisImageUrl }: PreorderScreenProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [search, setSearch] = React.useState("");
  const [filterKey, setFilterKey] = React.useState(PREORDER_FILTERS[0]!.key);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [payOpen, setPayOpen] = React.useState(false);
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
  const visible = preorders.filter(
    (order) =>
      (activeFilter.statuses.length === 0 || activeFilter.statuses.includes(order.status)) &&
      matchesPreorderSearch(order, search),
  );

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

  const action = selected ? resolvePreorderAction(selected) : null;

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Cari nomor pesanan atau nama pelanggan"
        aria-label="Cari nomor pesanan atau nama pelanggan"
        className="bg-white border-[1.5px] border-line rounded-[14px] min-h-[50px] px-4 text-ink text-[16px] placeholder:text-ink-soft/60 transition-colors focus:border-pink"
      />

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 tablet:mx-0 tablet:px-0 tablet:flex-wrap">
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

      {visible.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="Nggak ada pesanan yang cocok"
          description="Coba kata kunci lain, atau ganti filternya ya."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {visible.map((order) => {
            const status = PREORDER_STATUS[order.status];

            return (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(order.id)}
                  className="w-full flex items-center gap-3 text-left bg-white border-[1.5px] border-line rounded-[18px] p-3.5 hover:border-pink transition-colors"
                >
                  {/* Just the digits: the cashier is matching what the customer
                      reads off their phone, and the "PO-" is on every one. */}
                  <span className="flex-none font-[family-name:var(--font-display)] text-[19px] font-semibold text-pink-deep tabular-nums">
                    {order.orderNumber.split("-").at(-1)}
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="block text-[14.5px] font-bold text-ink truncate">
                      {order.customerName}
                    </span>
                    <span className="block text-[12.5px] text-ink-soft truncate">
                      {order.pickupSlot ? `ambil ${order.pickupSlot} · ` : ""}
                      {order.itemCount} item · {formatRupiah(order.totalAmount)}
                      {order.paymentStatus === "UNPAID" && (
                        <span className="text-hot font-semibold"> · belum bayar</span>
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
      {selected && action && !payOpen && (
        <Sheet
          open
          onClose={() => setSelectedId(null)}
          ariaLabel={`Pesanan ${selected.orderNumber}`}
        >
          <div className="flex flex-col gap-3 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                  Nomor pesanan
                </div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-pink-deep">
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
              {selected.customerName}
              {selected.pickupSlot ? ` · ambil ${selected.pickupSlot}` : ""} ·{" "}
              {PAYMENT_LABEL[selected.paymentMethod]}
            </p>

            <ul className="bg-cream rounded-[14px] p-3 flex flex-col gap-2">
              {selected.items.map((item, index) => (
                <li key={`${item.name}-${index}`} className="flex justify-between gap-3 text-sm">
                  <span className="text-ink">
                    {item.quantity}&times; {item.name}
                    {item.needsPrep && (
                      <Badge variant="prep" className="ml-1.5 align-middle">
                        racik
                      </Badge>
                    )}
                  </span>
                  <span className="flex-none text-ink-soft tabular-nums">
                    {formatRupiah(item.subtotal)}
                  </span>
                </li>
              ))}

              <li className="flex justify-between gap-3 border-t-[1.5px] border-dashed border-line pt-2 mt-1 font-bold text-ink">
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
                Pesanan ini belum dibayar. Terima pembayaran dulu sebelum diserahkan.
              </Note>
            )}

            {selected.paymentMethod === "QRIS" && selected.paymentProofUrl && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                  Bukti transfer pelanggan
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.paymentProofUrl}
                  alt={`Bukti transfer pesanan ${selected.orderNumber}`}
                  className="w-full max-h-[280px] object-contain rounded-[14px] border border-line bg-white"
                />
              </div>
            )}

            {action.kind === "BLOCKED" ? (
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
          </div>
        </Sheet>
      )}

      {selected && payOpen && (
        <PaymentSheet
          total={selected.totalAmount}
          qrisImageUrl={qrisImageUrl}
          fixedMethod={selected.paymentMethod}
          title={`Pembayaran ${selected.orderNumber}`}
          submitLabels={{
            CASH: "Pembayaran diterima",
            QRIS: "Transfer masuk, tandai lunas",
          }}
          onClose={closePayment}
          onSubmit={takePayment}
        />
      )}
    </div>
  );
}
