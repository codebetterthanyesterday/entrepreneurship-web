"use client";

import * as React from "react";
import useSWR from "swr";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isFinalStatus } from "@/lib/order-timeline";
import { OrderTimeline } from "./order-timeline";
import { OrderReceipt, SummaryPanel } from "./order-receipt";
import type { TrackedOrder } from "@/types/order-view";

/**
 * Eight seconds, for the same reason as the counter's list: the customer has to
 * see the timeline move within ten of the kitchen moving it, and a ten-second
 * interval spends its entire budget waiting before the request is even sent.
 */
const POLL_INTERVAL_MS = 8_000;

/** Derived, not typed out: the note on screen used to claim ten seconds. */
const POLL_SECONDS = Math.round(POLL_INTERVAL_MS / 1000);

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

export interface TrackViewProps {
  /** Prefilled from the confirmation page's "Lacak pesanan" link. */
  initialOrderNumber?: string;
}

export function TrackView({ initialOrderNumber = "" }: TrackViewProps) {
  const [orderNumber, setOrderNumber] = React.useState(initialOrderNumber);
  const [phoneLast4, setPhoneLast4] = React.useState("");
  const [search, setSearch] = React.useState<Search | null>(null);

  const { data, isLoading } = useSWR<TrackingResponse>(searchKey(search), fetchOrder, {
    // Stop polling once the order can no longer move, and never poll a miss.
    refreshInterval: (latest) =>
      latest?.order && !isFinalStatus(latest.order.status) ? POLL_INTERVAL_MS : 0,
    // Keep the last order on screen while the next poll is in flight, so the
    // page does not blink every few seconds.
    keepPreviousData: true,
    revalidateOnFocus: true,
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSearch({ orderNumber: orderNumber.trim(), phoneLast4: phoneLast4.trim() });
  };

  const order = data?.order ?? null;
  const searched = search !== null;

  return (
    <>
      {/* ------------------------------------------------------- heading ---- */}
      <section className="band-tight band-dark">
        <div className="band-inner">
          <p className="eyebrow text-pink">Lacak</p>
          <h1 className="display-2 mt-3 text-white">Pesanan kamu sampai mana?</h1>
          <p className="lede mt-4 text-white/70">
            Masukin nomor pesanan dan 4 digit terakhir WhatsApp kamu.
          </p>
        </div>
      </section>

      {/* The form sits on the light band, not the dark one: the fields are white,
          and their labels are ink — a working surface, not a statement. */}
      <section className="band-tight band-cream">
        <div className="band-inner">
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

            <Input
              label="4 digit terakhir WhatsApp"
              inputMode="numeric"
              maxLength={4}
              placeholder="7890"
              autoComplete="off"
              value={phoneLast4}
              onChange={(event) => setPhoneLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
              className="tabular-nums tablet:w-[190px]"
            />

            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading && !data}
              disabled={orderNumber.trim() === "" || phoneLast4.length < 4}
              className="flex-none px-7"
            >
              Cari
            </Button>
          </form>

          {searched && !order && !isLoading && (
            <div className="mt-12 max-w-[42ch]">
              <p className="eyebrow text-hot">Nggak ketemu</p>
              <p className="display-3 mt-3 text-ink">
                Nggak ada pesanan yang cocok dengan dua itu.
              </p>
              <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
                Nomor pesanannya ada di halaman konfirmasi dan di chat WhatsApp kami. Empat digitnya
                diambil dari nomor yang kamu isi waktu pesan.
              </p>

              <ButtonLink href="/menu" variant="ghost" size="sm" className="mt-6">
                Lihat menu
              </ButtonLink>
            </div>
          )}

          {order && (
            <div className="mt-10 flex items-start gap-8">
              <div className="min-w-0 flex-1">
                {/* The order's identity, on hairlines rather than in a card. The
                    number is set large because it is read out at the booth. */}
                <div className="flex flex-wrap items-end justify-between gap-4 border-t border-ink/15 pt-5">
                  <div>
                    <p className="eyebrow text-ink-soft">Nomor pesanan</p>
                    <p className="display-2 mt-1.5 text-pink-deep tabular-nums">
                      {order.orderNumber}
                    </p>
                  </div>

                  <Badge variant={order.needsPrep ? "prep" : "info"}>
                    {order.needsPrep ? "Perlu diracik" : "Siap ambil"}
                  </Badge>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 tablet:grid-cols-3">
                  <Fact label="Atas nama">{order.customerName}</Fact>
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

                {order.status === "CANCELLED" ? (
                  <div className="mt-8">
                    <p
                      role="status"
                      className="border-l-2 border-hot bg-hot-soft/70 py-3 pl-4 pr-3 text-[13.5px] leading-relaxed text-hot"
                    >
                      Pesanan ini dibatalkan. Kalau menurut kamu ini keliru, hubungi kami lewat
                      WhatsApp ya.
                    </p>
                    {order.notes && <Note text={order.notes} />}
                  </div>
                ) : (
                  <div className="mt-8 rounded-[22px] bg-white p-5 shadow-[0_18px_40px_-24px_rgba(74,43,56,0.28)]">
                    <h2 className="eyebrow mb-4 text-pink-deep">Perjalanan pesanan</h2>

                    <OrderTimeline status={order.status} needsPrep={order.needsPrep} />

                    {!isFinalStatus(order.status) && (
                      <p
                        className="mt-5 border-t border-line pt-3 text-[11.5px] text-ink-soft"
                        aria-live="polite"
                      >
                        Halaman ini nyegerin sendiri tiap {POLL_SECONDS} detik.
                      </p>
                    )}
                  </div>
                )}

                {order.notes && order.status !== "CANCELLED" && <Note text={order.notes} />}
              </div>

              <SummaryPanel>
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
              </SummaryPanel>
            </div>
          )}

          {/* The receipt for the one column a phone has. */}
          {order && (
            <div className="mt-10 desktop:hidden">
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
            </div>
          )}
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
      <dd className={cn("mt-1 text-[14.5px] font-semibold leading-snug text-ink")}>{children}</dd>
    </div>
  );
}

function Note({ text }: { text: string }) {
  return (
    <p className="mt-5 border-l-2 border-line pl-4 text-[13px] italic leading-relaxed text-ink-soft">
      {text}
    </p>
  );
}
