"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/hooks/use-cart";
import { submitPreorderAction } from "@/actions/order.actions";
import { ActionBar, OrderReceipt, SummaryPanel, cartLines } from "./order-receipt";
import { JourneyEmpty, JourneyHero } from "./journey";
import { CheckoutArt } from "./journey-art";
import type { PublicBundle } from "@/lib/bundle";
import type { BookableSchedule } from "@/lib/queries/schedule.query";
import { HandoverSteps, type HandoverChoice } from "./handover-picker";
import type { PublicProduct } from "@/types/admin";
import { lastFourDigits, rememberOrder } from "@/lib/remembered-order";


const QRIS_NOTE =
  "Habis kirim pesanan, QRIS-nya langsung muncul. Scan pakai e-wallet atau m-banking, bayar sesuai total, lalu unggah bukti bayarnya di situ.";

export interface CheckoutFormProps {
  products: PublicProduct[];
  /** The dates, places and time ranges a customer can book right now. */
  schedule: BookableSchedule;
  preorderOpen: boolean;
  /** Whether the admin has uploaded a QRIS; without one only cash is offered. */
  qrisAvailable: boolean;
  /** Pakets on sale, so a paket already in the cart is priced and sent. */
  bundles?: PublicBundle[];
}

const NO_BUNDLES: PublicBundle[] = [];

interface FieldError {
  message: string;
  field?: string;
}

export function CheckoutForm({
  products,
  schedule,
  preorderOpen,
  qrisAvailable,
  bundles = NO_BUNDLES,
}: CheckoutFormProps) {
  const router = useRouter();
  const cart = useCart(products, bundles);
  const nameOf = React.useCallback(
    (id: string) => products.find((product) => product.id === id)?.name,
    [products],
  );

  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [handover, setHandover] = React.useState<HandoverChoice>({
    location: null,
    detail: "",
    date: null,
    windowId: null,
  });
  // Preorders are paid by QRIS only; there is no choice to make.
  const paymentMethod = "QRIS" as const;
  const [notes, setNotes] = React.useState("");

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<FieldError | null>(null);

  // A ref, not the state above. Two taps can dispatch two submit events before
  // React re-renders with the disabled button, and both handlers would then
  // close over `isSubmitting === false`. A ref is written synchronously, so the
  // second handler sees the first one's flag immediately.
  const inFlight = React.useRef(false);

  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);
  const generalError = error && !error.field ? error.message : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (inFlight.current) return;
    inFlight.current = true;

    setIsSubmitting(true);
    setError(null);

    const result = await submitPreorderAction({
      customerName,
      customerPhone,
      handoverLocation: handover.location ?? undefined,
      handoverDetail: handover.detail.trim() === "" ? undefined : handover.detail.trim(),
      serviceWindowId: handover.windowId ?? "",
      paymentMethod,
      notes: notes.trim() === "" ? undefined : notes,
      // Loose products and pakets go apart; the server prices both again.
      ...cart.orderLines(),
    });

    if (!result.ok) {
      inFlight.current = false;
      setIsSubmitting(false);
      setError({ message: result.error, field: result.field });
      return;
    }

    // The flag is deliberately left set through the navigation — the order
    // exists now, and re-enabling the button would invite a second one.
    cart.clearCart();

    // So /lacak opens straight onto this order, without the customer typing
    // back what they have just typed here. Only the last four digits are kept.
    const phoneLast4 = lastFourDigits(customerPhone);
    if (phoneLast4) rememberOrder({ orderNumber: result.data.orderNumber, phoneLast4 });

    router.push(`/pesanan/${result.data.orderNumber}`);
  };

  const heading = (
    <JourneyHero
      step="data"
      eyebrow="Stage 3: final checkpoint"
      title="Mission: complete your order!"
      lede="Isi datanya biar kami nggak salah orang pas nyerahin pesanannya."
      art={<CheckoutArt />}
    />
  );

  if (!cart.isReady) {
    return (
      <>
        {heading}
        <section className="band-tight menu-counter">
          <div className="band-inner">
            <p className="text-sm text-ink-soft" aria-busy="true">
              Lagi ngambil keranjang kamu…
            </p>
          </div>
        </section>
      </>
    );
  }

  if (cart.entries.length === 0) {
    return (
      <>
        {heading}
        <section className="band menu-counter">
          <div className="band-inner">
            <JourneyEmpty
              eyebrow="Keranjang kosong"
              title="Nggak ada yang bisa dikirim dulu."
              body="Pilih menunya dulu, baru isi data di sini."
            >
              <ButtonLink href="/" className="mt-7">
                Lihat menu
              </ButtonLink>
            </JourneyEmpty>
          </div>
        </section>
      </>
    );
  }

  const lines = cartLines(cart.entries, nameOf);

  const submitButton = (
    <Button
      type="submit"
      form="checkout-form"
      variant="primary"
      fullWidth
      isLoading={isSubmitting}
      disabled={isSubmitting || !preorderOpen || !qrisAvailable}
    >
      {!preorderOpen ? "Preorder lagi ditutup" : qrisAvailable ? "Kirim pesanan" : "Pembayaran lagi disiapin"}
    </Button>
  );

  return (
    <>
      {heading}

      <section className="menu-counter py-6 tablet:py-10">
        <div className="band-inner">
          {!preorderOpen && (
            <p
              role="status"
              className="mb-6 border-l-2 border-warn bg-warn-soft/70 py-3 pl-4 pr-3 text-[13.5px] leading-relaxed text-warn"
            >
              Preorder lagi ditutup. Pesanan baru belum bisa dikirim, tapi keranjang kamu aman kok.
            </p>
          )}

          {generalError && (
            <p
              role="alert"
              className="mb-6 border-l-2 border-hot bg-hot-soft/70 py-3 pl-4 pr-3 text-[13.5px] font-medium leading-relaxed text-hot"
            >
              {generalError}
            </p>
          )}

          <div className="flex items-start gap-8">
            {/*
              Four numbered steps instead of four stacked fields.
              
              The form did not change — same ids, same handlers, same order — but a
              wall of labels gives no sense of how much is left.
            */}
            <form
              id="checkout-form"
              onSubmit={handleSubmit}
              className="min-w-0 flex-1 flex flex-col gap-3 tablet:gap-4"
            >
              <Step number="01" title="Data kamu">
                <div className="flex flex-col gap-4">
                  <Input
                    label="Nama kamu"
                    placeholder="Biar kami nggak salah panggil"
                    autoComplete="name"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    error={fieldError("customerName")}
                    disabled={isSubmitting}
                  />

                  <Input
                    label="Nomor WhatsApp"
                    inputMode="numeric"
                    placeholder="081234567890"
                    autoComplete="tel"
                    hint="Dipakai buat ngabarin pesanan kamu"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value.replace(/\D/g, ""))}
                    error={fieldError("customerPhone")}
                    disabled={isSubmitting}
                  />
                </div>
              </Step>

              <HandoverSteps
                schedule={schedule}
                value={handover}
                onChange={(next) => {
                  setHandover(next);
                  if (error?.field && ["handoverLocation", "handoverDetail", "serviceWindowId"].includes(error.field)) {
                    setError(null);
                  }
                }}
                disabled={isSubmitting}
                fieldError={fieldError}
                Step={Step}
              />

              <Step number="05" title="Bayarnya gimana?">
                <div className="min-w-0">
                  <div className="flex min-h-[52px] items-center gap-2 rounded-[8px] border-2 border-line bg-white px-3 text-[14.5px] font-semibold text-ink">
                    <PaymentIcon />
                    QRIS
                  </div>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">{QRIS_NOTE}</p>
                  <p className="mt-2 text-[12.5px] text-ink-soft">
                    Pesanan diproses setelah bukti bayarnya kami cek. Preorder nggak bisa dibayar tunai.
                  </p>
                  {!qrisAvailable && (
                    <p role="alert" className="mt-2 text-[13px] font-semibold text-hot">
                      Pembayaran QRIS lagi disiapin, jadi preorder belum bisa dikirim. Coba lagi sebentar ya.
                    </p>
                  )}
                  {fieldError("paymentMethod") && (
                    <p className="mt-2 text-sm text-hot">{fieldError("paymentMethod")}</p>
                  )}
                </div>
              </Step>

              <Step number="06" title="Catatan" hint="Opsional">
                <Textarea
                  label="Ada permintaan khusus?"
                  placeholder="Misal: es-nya dikit aja"
                  maxLength={200}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  error={fieldError("notes")}
                  disabled={isSubmitting}
                />
              </Step>

              {/* Said where the data is handed over, before the button that
                  sends it (UU PDP); the details are on /privasi. */}
              <p className="mt-6 text-[13px] leading-relaxed text-ink-soft">
                Nama, nomor WhatsApp, dan lokasi kamu cuma dipakai buat pesanan ini: menyiapkan dan
                menyerahkannya, menghubungi kamu soal pesanan, dan membuka foto booth kamu. Nggak dijual
                atau dibagikan.{" "}
                <Link href="/privasi" className="font-semibold text-pink-deep underline underline-offset-4">
                  Selengkapnya
                </Link>
              </p>

              {fieldError("items") && (
                <p
                  role="alert"
                  className="mt-6 border-l-2 border-hot bg-hot-soft/70 py-3 pl-4 pr-3 text-[13.5px] font-medium leading-relaxed text-hot"
                >
                  {fieldError("items")}
                </p>
              )}
            </form>

            <SummaryPanel>
              <OrderReceipt lines={lines} total={cart.total} title="Pesanan kamu" />
              <div className="mt-5">{submitButton}</div>
            </SummaryPanel>
          </div>

          {/* The receipt again, in the one column a phone has — the panel above is
              hidden there, and someone should be able to check the bill without
              going back. */}
          <OrderReceipt
            lines={lines}
            total={cart.total}
            title="Pesanan kamu"
            className="receipt-paper mt-8 desktop:hidden"
          />
        </div>
      </section>

      <ActionBar itemCount={cart.itemCount} total={cart.total}>
        {submitButton}
      </ActionBar>
    </>
  );
}

/**
 * One step of the checkout.
 *
 * The number is decoration — the heading below it already names the step — so it
 * is hidden from a screen reader, which gets the same sequence from the headings.
 */
function Step({
  number,
  title,
  hint,
  children,
}: {
  number: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    // A ticket on the counter: one card per step, the number set large like the
    // number on an order slip.
    <div className="k-form-card bg-white p-4 tablet:p-6">
      <div className="flex items-center gap-3">
        <span
          className="k-num"
          aria-hidden="true"
        >
          {number}
        </span>
        <h2 className="display-3 flex-1 text-ink">{title}</h2>
        {hint && <span className="eyebrow max-w-[40%] text-right text-ink-soft">{hint}</span>}
      </div>

      <div className="mt-4">{children}</div>
    </div>
  );
}

/** A QR code: how a preorder is paid. */
function PaymentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="4" width="6" height="6" rx="1.2" />
        <rect x="14" y="4" width="6" height="6" rx="1.2" />
        <rect x="4" y="14" width="6" height="6" rx="1.2" />
      </g>
      <path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5z" fill="currentColor" />
    </svg>
  );
}
