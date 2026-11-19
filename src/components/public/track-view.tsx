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
import { OrderTicket } from "./order-ticket";
import { QrisPayment } from "./qris-payment";
import { PhotoboothQr } from "./photobooth-qr";
import { OrderStage, StageArt } from "./order-stage";
import { Confetti } from "./confetti";
import { JourneyHero } from "./journey";
import { ChatLink } from "./whatsapp-chat";
import { chatOrderOf } from "@/lib/whatsapp";
import { isDelivered } from "@/lib/schedule";
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
  photoLink?: string | null;
  qrisImageUrl?: string | null;
  /** Too many misses lately: nothing was looked up. */
  retryAfterSeconds?: number;
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

  const { data, error, isLoading, mutate } = useSWR<TrackingResponse>(searchKey(search), fetchOrder, {
    // Stop polling once the order can no longer move, and never poll a miss.
    refreshInterval: (latest) =>
      latest?.order && !isFinalStatus(latest.order.status) ? POLL_INTERVAL_MS : 0,
    revalidateOnFocus: true,
  });

  const order = data?.order ?? null;
  const limited = search !== null && data?.retryAfterSeconds !== undefined;
  const missed = search !== null && data !== undefined && order === null && !limited;

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
        photoLink={data?.photoLink ?? null}
        qrisImageUrl={data?.qrisImageUrl ?? null}
        phoneLast4={search?.phoneLast4}
        onProofSent={() => void mutate()}
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
        eyebrow="Radar station"
        title="Where's your mission?"
        lede="Masukin nomor pesanan dan 4 digit terakhir WhatsApp kamu."
        art={<StageArt id="masuk" />}
      />

      {/* The form sits on the light band, not the dark one: the fields are white,
          and their labels are ink — a working surface, not a statement. */}
      <section className="band-tight menu-counter">
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
            Nomor pesanannya ada di halaman konfirmasi pesanan. Sekali ketemu, HP ini bakal inget —
            nanti tinggal buka halaman ini lagi.
          </p>
          <ChatLink intent={{ kind: "forgotNumber" }} look="quiet" className="text-[13px]">
            Lupa nomor pesanannya? Tanya kami
          </ChatLink>

          {error && !data && (
            <p role="alert" className="mt-10 max-w-[42ch] text-[14px] leading-relaxed text-hot">
              Koneksinya lagi putus, jadi pesanannya belum bisa dicek. Coba sebentar lagi ya.
            </p>
          )}

          {limited && (
            <div role="status" className="k-hard-sm stage-enter mt-10 rounded-[10px] bg-white p-4">
              <p className="eyebrow text-hot">Tunggu sebentar</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink">
                Udah kebanyakan percobaan yang nggak cocok, jadi pencarian dijeda dulu. Coba lagi{" "}
                {Math.max(1, Math.ceil((data?.retryAfterSeconds ?? 60) / 60))} menit lagi, atau buka
                halaman pesanan dari tautan yang kamu simpan.
              </p>
            </div>
          )}

          {missed && (
            // The design's "quest data not found": said loudly enough to be
            // noticed, then straight to the two things worth checking.
            <div role="status" className="k-err stage-enter mt-10">
              <p className="k-err-bar">
                <span>Game over alert // 0 targets acquired</span>
                <span>ERR: W4-404</span>
              </p>
              <div className="grid gap-3.5 p-3.5 tablet:p-5">
                <div className="k-hard-sm rounded-[10px] bg-white p-4">
                  <p className="eyebrow text-hot">Nggak ketemu</p>
                  <p className="k-section-title mt-1 !text-pink-deep">Oops! Quest data not found!</p>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink">
                    Nggak ada pesanan yang cocok dengan nomor{" "}
                    <code className="k-code-chip">{submitted?.orderNumber || "—"}</code> dan empat
                    digit itu. Kemungkinan salah ketik nomornya, atau digitnya bukan dari WhatsApp
                    yang kamu isi waktu pesan.
                  </p>
                </div>

                <div className="k-hard-sm rounded-[10px] bg-[#fde7c4] p-4">
                  <p className="k-mono text-[12px] text-ink">Checklist pemeriksaan petualang:</p>
                  <ol className="mt-2 grid gap-2.5 text-[14.5px] leading-relaxed text-ink">
                    <li className="flex gap-2.5">
                      <span aria-hidden="true" className="k-check-num">
                        1
                      </span>
                      <span>
                        <b>Format PO-XXXX.</b> Nomor pesanan ada di halaman konfirmasi dan di chat
                        WhatsApp kami.
                      </span>
                    </li>
                    <li className="flex gap-2.5">
                      <span aria-hidden="true" className="k-check-num">
                        2
                      </span>
                      <span>
                        <b>Nomor WhatsApp.</b> Masukin 4 angka terakhir nomor yang kamu daftarin
                        waktu checkout.
                      </span>
                    </li>
                  </ol>
                </div>

                <ButtonLink href="/" variant="ghost" size="sm" className="justify-self-start">
                  Lihat menu
                </ButtonLink>
              </div>
            </div>
          )}

          <TrackGuide />
        </div>
      </section>
    </>
  );
}

// ------------------------------------------------------------------ guide

const GUIDE = [
  {
    tag: "Code: PO-XXXX",
    title: "1. Dapatkan nomor pesanan",
    body: "Selesai checkout, kamu dapat nomor pesanan (contoh: PO-0007) di halaman konfirmasi.",
    tone: "var(--color-pink-deep)",
  },
  {
    tag: "4 digit PIN",
    title: "2. Masukin 4 digit WhatsApp",
    body: "Biar pesananmu nggak diintip orang lain, masukin 4 digit terakhir nomor WhatsApp kamu.",
    tone: "var(--k-gold)",
  },
  {
    tag: "Checkpoints",
    title: "3. Pantau tiap checkpoint",
    body: "Lihat posisi pesananmu dari masuk, dikonfirmasi, diracik, sampai siap diserahkan.",
    tone: "var(--color-sky-deep)",
  },
] as const;

/**
 * "Bagaimana cara kerja radar pesanan?" — the three steps under the search
 * form. The design illustrates each with a picture; those are artwork this
 * repo does not have, so each card carries its number on the step's colour
 * instead and the words do the explaining.
 */
function TrackGuide() {
  return (
    <section aria-labelledby="track-guide" className="mt-12">
      <p className="k-mono text-[11px] text-sky-deep">Guide &amp; mission recovery</p>
      <h2 id="track-guide" className="k-section-title mt-1.5 !text-[clamp(20px,6vw,32px)]">
        Gimana cara kerja radar pesanan?
      </h2>

      <ol className="mt-4 grid gap-5 tablet:grid-cols-3">
        {GUIDE.map((step, index) => (
          <li key={step.title} className="k-hard bg-white p-4">
            <span
              aria-hidden="true"
              className="k-hard-sm inline-grid h-9 w-9 place-items-center font-[family-name:var(--font-display)] text-[16px] font-black text-white"
              style={{ background: step.tone }}
            >
              {index + 1}
            </span>
            <span className="k-tag ml-3 align-middle">{step.tag}</span>
            <h3 className="mt-3 font-[family-name:var(--font-display)] text-[17px] font-extrabold uppercase leading-tight text-ink">
              {step.title}
            </h3>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ------------------------------------------------------------------ found

function FoundOrder({
  order,
  photoLink,
  qrisImageUrl,
  phoneLast4,
  onProofSent,
  burst,
  offline,
  onSwitch,
}: {
  order: TrackedOrder;
  photoLink: string | null;
  qrisImageUrl: string | null;
  phoneLast4?: string;
  onProofSent: () => void;
  burst: number;
  offline: boolean;
  onSwitch: () => void;
}) {
  const cancelled = order.status === "CANCELLED";
  const delivered = isDelivered(order);
  const live = !isFinalStatus(order.status);

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
            <OrderStage
              status={order.status}
              needsPrep={order.needsPrep}
              delivered={delivered}
              titleAs="h1"
              chatOrder={chatOrderOf(order)}
            >
              {order.status === "READY" && (
                <p className="mx-auto mt-4 inline-flex flex-col items-center rounded-[20px] bg-white/[0.06] px-6 py-3 tablet:mt-6 tablet:py-4">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/60">
                    {delivered ? "Tunjukin ke tim kami" : "Tunjukin ke kasir"}
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
      <section className="band-tight menu-counter">
        <div className="band-inner">
          <div className="min-w-0">
            {order.paymentMethod === "QRIS" && !cancelled && (
              <QrisPayment
                orderNumber={order.orderNumber}
                totalAmount={order.totalAmount}
                qrisImageUrl={qrisImageUrl}
                paymentStatus={order.paymentStatus}
                hasPaymentProof={order.hasPaymentProof}
                delivered={delivered}
                phoneLast4={phoneLast4}
                onProofSent={onProofSent}
                className="mb-7"
              />
            )}

            {/* The ticket carries what used to be three loose facts here — the
                slot, how it is paid, whether it is — and the receipt. */}
            <OrderTicket order={order} />

            {!cancelled && (
              <div className="k-form-card mt-7 bg-white p-4 tablet:p-6">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="k-tag k-tag-red k-tag-flat">Overworld radar</span>
                  <span className="k-mono text-[10.5px] text-sky-deep">Order progression</span>
                </p>
                <h2 className="k-section-title mt-2">Perjalanan pesanan</h2>
                <OrderTimeline status={order.status} needsPrep={order.needsPrep} delivered={delivered} />
              </div>
            )}

            {order.notes && (
              <p className="mt-8 border-l-2 border-line pl-4 text-[13px] italic leading-relaxed text-ink-soft">
                {order.notes}
              </p>
            )}

            {photoLink && (
              <PhotoboothQr
                link={photoLink}
                orderNumber={order.orderNumber}
                direct={photoLink.includes("t=")}
                className="mt-9"
              />
            )}

            <div className="mt-8 flex flex-col gap-3 tablet:flex-row">
              <ButtonLink href="/" variant="primary" className="tablet:flex-none">
                Play again (pesan lagi)
              </ButtonLink>
              <ButtonLink href="/keranjang" variant="ghost" className="tablet:flex-none">
                Lihat keranjang
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
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
