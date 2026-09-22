"use client";

import * as React from "react";
import useSWR from "swr";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isFinalStatus } from "@/lib/order-timeline";
import {
  forgetRememberedOrder,
  parseRememberedOrder,
  readRememberedOrderRaw,
  rememberOrder,
  subscribeRememberedOrder,
} from "@/lib/remembered-order";
import { OrderTimeline } from "./order-timeline";
import { OrderReceipt, SummaryPanel } from "./order-receipt";
import { OrderStage, StageArt } from "./order-stage";
import { Confetti } from "./confetti";
import { JourneyHero } from "./journey";
import type { OrderStatus } from "@/types/order";
import type { TrackedOrder } from "@/types/order-view";

/**
 * Eight seconds, for the same reason as the counter's list: the customer has to
 * see the timeline move within ten of the kitchen moving it, and a ten-second
 * interval spends its entire budget waiting before the request is even sent.
 */
const POLL_INTERVAL_MS = 8_000;

interface TrackingResponse {
  order: TrackedOrder | null;
}

interface Search {
  orderNumber: string;
  phoneLast4: string;
}

async function fetchOrder(url: string): Promise<TrackingResponse> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Gagal mengambil data pesanan");
  return (await response.json()) as TrackingResponse;
}

function searchKey(search: Search | null): string | null {
  if (!search) return null;

  const params = new URLSearchParams({
    no: search.orderNumber,
    wa: search.phoneLast4,
  });

  return `/api/lacak?${params.toString()}`;
}

const PAYMENT_LABEL = {
  CASH: "Bayar pas ambil",
  QRIS: "Transfer / QRIS",
} as const;

/**
 * What the server snapshot of the remembered order reads as: "not known yet",
 * which is different from "nothing remembered". Rendering the form on the server
 * and swapping it for the stage on hydration would flash a form at the very
 * customer the memory exists to spare it.
 */
const NOT_READ_YET = "\u0000server";
const onServer = () => NOT_READ_YET;

export interface TrackViewProps {
  /** Prefilled from the confirmation page's "Lacak pesanan" link. */
  initialOrderNumber?: string;
}

export function TrackView({ initialOrderNumber = "" }: TrackViewProps) {
  const rememberedRaw = React.useSyncExternalStore(
    subscribeRememberedOrder,
    readRememberedOrderRaw,
    onServer,
  );
  const hydrated = rememberedRaw !== NOT_READ_YET;
  // Memoised on the raw text so it keeps its identity between renders: the
  // automatic search below is compared by reference.
  const remembered = React.useMemo(
    () => (hydrated ? parseRememberedOrder(rememberedRaw) : null),
    [hydrated, rememberedRaw],
  );

  const [orderNumber, setOrderNumber] = React.useState(initialOrderNumber);
  const [phoneLast4, setPhoneLast4] = React.useState("");
  const [submitted, setSubmitted] = React.useState<Search | null>(null);

  // A remembered order is opened on its own — unless the link names a different
  // one, in which case the link wins and the customer types the digits.
  const automatic: Search | null =
    remembered && (initialOrderNumber === "" || initialOrderNumber === remembered.orderNumber)
      ? remembered
      : null;
  const search = submitted ?? automatic;

  const { data, error, isLoading } = useSWR<TrackingResponse>(searchKey(search), fetchOrder, {
    // Stop polling once the order can no longer move, and never poll a miss.
    refreshInterval: (latest) =>
      latest?.order && !isFinalStatus(latest.order.status) ? POLL_INTERVAL_MS : 0,
    revalidateOnFocus: true,
  });

  const order = data?.order ?? null;
  const missed = search !== null && data !== undefined && order === null;

  // Keep what worked, forget what no longer does. Writes to localStorage, not to
  // React state, so these are effects in the proper sense.
  React.useEffect(() => {
    if (!search || !data) return;
    if (data.order) {
      if (
        remembered?.orderNumber !== data.order.orderNumber ||
        remembered.phoneLast4 !== search.phoneLast4
      ) {
        rememberOrder({
          orderNumber: data.order.orderNumber,
          phoneLast4: search.phoneLast4,
        });
      }
    } else if (search === automatic) {
      forgetRememberedOrder();
    }
  }, [data, search, automatic, remembered]);

  // The moment worth celebrating: the order turning ready while the customer is
  // watching. Tracked during render — React's pattern for reacting to a changed
  // value — so the confetti starts in the same paint as the new stage.
  const [seen, setSeen] = React.useState<{
    orderNumber: string;
    status: OrderStatus;
  } | null>(null);
  const [burst, setBurst] = React.useState(0);
  if (order && (seen?.orderNumber !== order.orderNumber || seen.status !== order.status)) {
    if (seen?.orderNumber === order.orderNumber && order.status === "READY") {
      setBurst((count) => count + 1);
    }
    setSeen({ orderNumber: order.orderNumber, status: order.status });
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted({
      orderNumber: orderNumber.trim(),
      phoneLast4: phoneLast4.trim(),
    });
  };

  const switchOrder = () => {
    forgetRememberedOrder();
    setSubmitted(null);
    setOrderNumber("");
    setPhoneLast4("");
  };

  if (!hydrated) return <StagePlaceholder />;
  if (search && isLoading) return <StagePlaceholder label="Lagi nyari pesanan kamu…" />;

  if (order) {
    return (
      <FoundOrder
        order={order}
        burst={burst}
        offline={error !== undefined}
        onSwitch={switchOrder}
      />
    );
  }

  return (
    <>
      {/* ------------------------------------------------------- heading ---- */}
      <JourneyHero
        step="track"
        eyebrow="Lacak"
        title="Pesanan kamu sampai mana?"
        lede="Masukin nomor pesanan dan 4 digit terakhir WhatsApp kamu."
        art={<StageArt id="masuk" />}
      />

      {/* The form sits on the light band, not the dark one: the fields are white,
          and their labels are ink — a working surface, not a statement. */}
      <section className="band-tight band-cream">
        <div className="band-inner stage-enter">
          <form
            onSubmit={handleSubmit}
            className="flex max-w-[640px] flex-col gap-3 tablet:flex-row tablet:items-end"
          >
            <Input
              label="Nomor pesanan"
              placeholder="PO-0001"
              autoComplete="off"
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value.toUpperCase())}
              className="tabular-nums"
            />

            {/* The width goes on a wrapper: `Input` stretches its own box to fill
                the row, so a width on the field left a gap before the button. */}
            <div className="tablet:w-[190px] tablet:flex-none">
              <Input
                label="4 digit terakhir WhatsApp"
                inputMode="numeric"
                maxLength={4}
                placeholder="7890"
                autoComplete="off"
                value={phoneLast4}
                onChange={(event) =>
                  setPhoneLast4(event.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="tabular-nums"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={orderNumber.trim() === "" || phoneLast4.length < 4}
              className="flex-none px-7"
            >
              Cari
            </Button>
          </form>

          <p className="mt-4 max-w-[52ch] text-[12.5px] leading-relaxed text-ink-soft">
            Nomor pesanannya ada di halaman konfirmasi dan di chat WhatsApp kami. Sekali ketemu, HP
            ini bakal inget — nanti tinggal buka halaman ini lagi.
          </p>

          {error && !data && (
            <p role="alert" className="mt-10 max-w-[42ch] text-[14px] leading-relaxed text-hot">
              Koneksinya lagi putus, jadi pesanannya belum bisa dicek. Coba sebentar lagi ya.
            </p>
          )}

          {missed && (
            <div role="status" className="stage-enter mt-12 max-w-[42ch]">
              <p className="eyebrow text-hot">Nggak ketemu</p>
              <p className="display-3 mt-3 text-ink">
                Nggak ada pesanan yang cocok dengan dua itu.
              </p>
              <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
                Cek lagi nomornya, dan pastiin empat digitnya dari nomor WhatsApp yang kamu isi
                waktu pesan.
              </p>

              <ButtonLink href="/menu" variant="ghost" size="sm" className="mt-6">
                Lihat menu
              </ButtonLink>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

// ------------------------------------------------------------------ found

function FoundOrder({
  order,
  burst,
  offline,
  onSwitch,
}: {
  order: TrackedOrder;
  burst: number;
  offline: boolean;
  onSwitch: () => void;
}) {
  const cancelled = order.status === "CANCELLED";
  const live = !isFinalStatus(order.status);

  const receipt = (
    <OrderReceipt
      lines={order.items.map((item, index) => ({
        key: `${item.name}-${index}`,
        name: item.name,
        quantity: item.quantity,
        subtotal: item.subtotal,
      }))}
      total={order.totalAmount}
      title="Rincian"
    />
  );

  return (
    <>
      {/* -------------------------------------------------------- stage ---- */}
      <section className="band band-dark band-glow !pt-4 !pb-10 tablet:!pt-8 tablet:!pb-[var(--band-y)]">
        <Confetti fire={burst} />

        <div className="band-inner">
          <div className="stage-enter flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[13px] text-white/70">
              <span className="font-semibold text-white tabular-nums">{order.orderNumber}</span>
              <span aria-hidden="true"> &middot; </span>
              <span className="sr-only">, atas nama </span>
              {order.customerName}
            </p>

            <button
              type="button"
              onClick={onSwitch}
              className="min-h-[44px] flex-none rounded-full border border-white/40 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              Ganti pesanan
            </button>
          </div>

          <div className="mt-3 tablet:mt-4">
            <OrderStage status={order.status} needsPrep={order.needsPrep} titleAs="h1">
              {order.status === "READY" && (
                <p className="mx-auto mt-4 inline-flex flex-col items-center rounded-[20px] bg-white/[0.06] px-6 py-3 tablet:mt-6 tablet:py-4">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/60">
                    Tunjukin ke kasir
                  </span>
                  <span className="display-2 mt-1 text-white tabular-nums">
                    {order.orderNumber}
                  </span>
                </p>
              )}
            </OrderStage>
          </div>

          {/* Says the page is alive without a sentence about seconds. */}
          {live && (
            <p
              aria-live="polite"
              className="mt-6 flex items-center justify-center gap-2 text-[12px] text-white/60 tablet:mt-8"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 flex-none rounded-full",
                  offline ? "bg-hot-soft" : "live-dot bg-ok-soft",
                )}
              />
              {offline
                ? "Koneksi putus — nyoba nyambung lagi…"
                : "Live · berubah sendiri begitu dapur gerak"}
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------ details ---- */}
      <section className="band-tight band-cream">
        <div className="band-inner flex items-start gap-10">
          <div className="min-w-0 flex-1">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-5 tablet:grid-cols-3">
              {order.pickupSlot && (
                <Fact label="Jam ambil">
                  <span className="tabular-nums">{order.pickupSlot}</span>
                </Fact>
              )}
              <Fact label="Pembayaran">{PAYMENT_LABEL[order.paymentMethod]}</Fact>
              <Fact label="Status bayar">
                <span className={order.paymentStatus === "PAID" ? "text-ok" : "text-warn"}>
                  {order.paymentStatus === "PAID" ? "Udah lunas" : "Belum dibayar"}
                </span>
              </Fact>
            </dl>

            {!cancelled && (
              <div className="mt-9">
                <h2 className="eyebrow mb-5 text-pink-deep">Perjalanan pesanan</h2>
                <OrderTimeline status={order.status} needsPrep={order.needsPrep} />
              </div>
            )}

            {order.notes && (
              <p className="mt-8 border-l-2 border-line pl-4 text-[13px] italic leading-relaxed text-ink-soft">
                {order.notes}
              </p>
            )}

            {/* The receipt for the one column a phone has. */}
            <div className="mt-10 desktop:hidden">{receipt}</div>
          </div>

          <SummaryPanel>{receipt}</SummaryPanel>
        </div>
      </section>
    </>
  );
}

/** One labelled fact about the order. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow text-ink-soft">{label}</dt>
      <dd className="mt-1 text-[14.5px] font-semibold leading-snug text-ink">{children}</dd>
    </div>
  );
}

/**
 * The dark band while the answer is not in yet: an empty ring, breathing. Same
 * shape as the stage it becomes, so nothing jumps when the order arrives.
 */
export function StagePlaceholder({ label }: { label?: string }) {
  return (
    <section
      className="band band-dark band-glow !pt-4 !pb-10 tablet:!pt-8 tablet:!pb-[var(--band-y)]"
      aria-busy="true"
    >
      <div className="band-inner text-center">
        <div className="h-11" />
        <div className="relative mx-auto mt-3 aspect-square w-[11.5rem] min-[380px]:w-[13.5rem] tablet:mt-4 tablet:w-[15.5rem]">
          <div className="stage-halo absolute inset-[8%] animate-pulse rounded-full" />
        </div>
        <p role="status" className="-mt-4 min-h-[1.5em] text-[14px] text-white/60 tablet:-mt-6">
          {label}
        </p>
      </div>
    </section>
  );
}
