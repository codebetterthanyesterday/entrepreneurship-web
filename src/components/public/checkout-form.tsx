"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/hooks/use-cart";
import { submitPreorderAction } from "@/actions/order.actions";
import { cn } from "@/lib/utils";
import { ActionBar, OrderReceipt, SummaryPanel, cartLines } from "./order-receipt";
import type { PublicPickupSlot } from "@/lib/queries/slot.query";
import type { PublicProduct } from "@/types/admin";

type PaymentMethod = "CASH" | "QRIS";

const PAYMENT_NOTE: Record<PaymentMethod, string> = {
  CASH: "Bayarnya pas ambil aja, siapkan uang pas ya kalau bisa",
  QRIS: "Nanti kami kirim QRIS lewat WhatsApp. Pesanan dikunci setelah transfer masuk.",
};

export interface CheckoutFormProps {
  products: PublicProduct[];
  slots: PublicPickupSlot[];
  preorderOpen: boolean;
}

interface FieldError {
  message: string;
  field?: string;
}

export function CheckoutForm({ products, slots, preorderOpen }: CheckoutFormProps) {
  const router = useRouter();
  const cart = useCart(products);

  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [pickupSlot, setPickupSlot] = React.useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("CASH");
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
      pickupSlot: pickupSlot ?? "",
      paymentMethod,
      notes: notes.trim() === "" ? undefined : notes,
      items: cart.entries.map((entry) => ({
        productId: entry.productId,
        quantity: entry.quantity,
      })),
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
    router.push(`/pesanan/${result.data.orderNumber}`);
  };

  const heading = (
    <section className="band-tight band-dark">
      <div className="band-inner">
        <p className="eyebrow text-pink">Checkout &middot; langkah terakhir</p>
        <h1 className="display-2 mt-3 text-white">Dikit lagi selesai</h1>
        <p className="lede mt-4 text-white/70">
          Isi datanya biar kami nggak salah panggil pas kamu ambil.
        </p>
      </div>
    </section>
  );

  if (!cart.isReady) {
    return (
      <>
        {heading}
        <section className="band-tight band-cream">
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
        <section className="band band-cream">
          <div className="band-inner">
            <div className="max-w-[40ch]">
              <p className="eyebrow text-pink-deep">Keranjang kosong</p>
              <p className="display-3 mt-3 text-ink">Nggak ada yang bisa dikirim dulu.</p>
              <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
                Pilih menunya dulu, baru isi data di sini.
              </p>

              <ButtonLink href="/menu" className="mt-7">
                Lihat menu
              </ButtonLink>
            </div>
          </div>
        </section>
      </>
    );
  }

  const lines = cartLines(cart.entries);

  const submitButton = (
    <Button
      type="submit"
      form="checkout-form"
      variant="primary"
      fullWidth
      isLoading={isSubmitting}
      disabled={isSubmitting || !preorderOpen}
    >
      {preorderOpen ? "Kirim pesanan" : "Preorder lagi ditutup"}
    </Button>
  );

  return (
    <>
      {heading}

      <section className="band-tight band-cream">
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
              wall of labels gives no sense of how much is left, and the numbers
              carry the same rhythm as the profile page's sections.
            */}
            <form
              id="checkout-form"
              onSubmit={handleSubmit}
              className="min-w-0 flex-1 flex flex-col"
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

              <Step number="02" title="Mau ambil jam berapa?">
                <fieldset disabled={isSubmitting} className="min-w-0">
                  <legend className="sr-only">Jam pengambilan</legend>

                  {slots.length === 0 ? (
                    <p className="text-sm text-ink-soft">
                      Belum ada jam ambil yang dibuka. Coba lagi nanti ya.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {slots.map((slot) => {
                        const active = pickupSlot === slot.label;
                        const reason = slot.isPast ? "Udah lewat" : slot.isFull ? "Penuh" : null;

                        return (
                          <button
                            key={slot.id}
                            type="button"
                            aria-pressed={active}
                            disabled={!slot.isSelectable}
                            onClick={() => {
                              setPickupSlot(slot.label);
                              if (error?.field === "pickupSlot") setError(null);
                            }}
                            className={cn(
                              "min-h-[58px] rounded-[14px] border-[1.5px] px-3.5 text-left transition-colors",
                              // Ink, not pink, for the chosen one — the same
                              // filled-dark selection the catalogue's category bar
                              // uses, so "selected" looks the same everywhere.
                              active
                                ? "border-ink bg-ink text-white"
                                : "border-line bg-white text-ink hover:border-pink",
                              !slot.isSelectable &&
                                "cursor-not-allowed opacity-45 hover:border-line",
                            )}
                          >
                            <span className="block text-[14.5px] font-semibold tabular-nums">
                              {slot.label}
                            </span>
                            <span
                              className={cn(
                                "eyebrow mt-0.5 block",
                                active ? "text-white/60" : "text-ink-soft",
                              )}
                            >
                              {reason ?? `Sisa ${Math.max(0, slot.quota - slot.booked)} tempat`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {fieldError("pickupSlot") && (
                    <p className="mt-2 text-sm text-hot">{fieldError("pickupSlot")}</p>
                  )}
                </fieldset>
              </Step>

              <Step number="03" title="Bayarnya gimana?">
                <fieldset disabled={isSubmitting} className="min-w-0">
                  <legend className="sr-only">Cara pembayaran</legend>

                  <div className="grid grid-cols-2 gap-2">
                    {(["CASH", "QRIS"] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        aria-pressed={paymentMethod === method}
                        onClick={() => setPaymentMethod(method)}
                        className={cn(
                          "min-h-[52px] rounded-[14px] border-[1.5px] px-3 text-[14.5px] font-semibold transition-colors",
                          paymentMethod === method
                            ? "border-ink bg-ink text-white"
                            : "border-line bg-white text-ink hover:border-pink",
                        )}
                      >
                        {method === "CASH" ? "Bayar pas ambil" : "Transfer / QRIS"}
                      </button>
                    ))}
                  </div>

                  <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
                    {PAYMENT_NOTE[paymentMethod]}
                  </p>
                  {fieldError("paymentMethod") && (
                    <p className="mt-2 text-sm text-hot">{fieldError("paymentMethod")}</p>
                  )}
                </fieldset>
              </Step>

              <Step number="04" title="Catatan" hint="Opsional" isLast>
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
          <div className="mt-10 desktop:hidden">
            <OrderReceipt lines={lines} total={cart.total} title="Pesanan kamu" />
          </div>
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
  isLast,
  children,
}: {
  number: string;
  title: string;
  hint?: string;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("border-t border-line py-7 first:border-t-0 first:pt-0", isLast && "pb-0")}>
      <div className="flex items-baseline gap-3">
        <span className="eyebrow flex-none text-pink-deep" aria-hidden="true">
          {number}
        </span>
        <h2 className="display-3 flex-1 text-ink">{title}</h2>
        {hint && <span className="eyebrow flex-none text-ink-soft">{hint}</span>}
      </div>

      <div className="mt-5">{children}</div>
    </div>
  );
}
