"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn, formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChatLink } from "@/components/public/whatsapp-chat";
import { useToast } from "@/components/ui/use-toast";
import { shrinkImage } from "@/lib/shrink-image";
import { REMEMBERED_ORDER_KEY, parseRememberedOrder } from "@/lib/remembered-order";
import type { ActionResult } from "@/lib/action-result";
import type { PaymentStatus } from "@/types/order";

export interface QrisPaymentProps {
  orderNumber: string;
  totalAmount: number;
  qrisImageUrl: string | null;
  paymentStatus: PaymentStatus;
  hasPaymentProof: boolean;
  /** Known on the tracker, which asked for them; read from this device otherwise. */
  phoneLast4?: string;
  /** After a proof is sent: the tracker re-polls; elsewhere the page refreshes. */
  onProofSent?: () => void;
  className?: string;
}

/**
 * Paying a preorder by QRIS, right on the order page.
 *
 * The booth's QRIS (uploaded by an admin), the exact amount, how to scan it
 * from the same phone, and a place to send the proof. Sending a proof does not
 * mark the order paid: the cashier checks the payment arrived in the merchant
 * app and marks it, and this card turns into "Lunas" on its own.
 */
export function QrisPayment({
  orderNumber,
  totalAmount,
  qrisImageUrl,
  paymentStatus,
  hasPaymentProof,
  phoneLast4,
  onProofSent,
  className,
}: QrisPaymentProps) {
  if (paymentStatus === "PAID") {
    return (
      <section
        aria-label="Pembayaran QRIS"
        className={cn("flex items-center gap-3 rounded-[20px] bg-ok-soft p-4", className)}
      >
        <span
          aria-hidden="true"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-ok text-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5">
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>
          <span className="block font-bold text-ok">Lunas via QRIS</span>
          <span className="block text-[13px] text-ink-soft">Pembayaranmu udah dicek kasir. Tinggal ambil pesanannya.</span>
        </span>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="qris-pay-title"
      className={cn(
        "overflow-hidden rounded-[24px] bg-white shadow-[0_18px_36px_-24px_rgba(46,33,32,0.55)]",
        className,
      )}
    >
      <div className="bg-ink-deep px-4 py-4 text-white tablet:px-6">
        <h2 id="qris-pay-title" className="eyebrow text-pink">
          Bayar pakai QRIS
        </h2>
        <p className="mt-1 flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-white/70">Bayar persis</span>
          <span className="font-[family-name:var(--font-display)] text-[28px] font-semibold tabular-nums">
            {formatRupiah(totalAmount)}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-5 p-4 tablet:flex-row tablet:p-6">
        {qrisImageUrl ? (
          <div className="flex flex-col items-center gap-2 tablet:w-[240px] tablet:flex-none">
            <div className="w-full max-w-[260px] rounded-[18px] border-[1.5px] border-line bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrisImageUrl}
                alt={`QRIS untuk membayar pesanan ${orderNumber}`}
                className="aspect-square w-full object-contain"
              />
            </div>
            <a
              href={qrisImageUrl}
              download={`QRIS-${orderNumber}.png`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold text-pink-deep underline underline-offset-4"
            >
              Simpan gambar QRIS
            </a>
          </div>
        ) : (
          <p className="rounded-[14px] bg-warn-soft p-3 text-[13.5px] leading-relaxed text-warn">
            QRIS-nya lagi nggak bisa ditampilkan. Bayar langsung ke kasir pas ambil ya, sebut
            nomor pesananmu.
          </p>
        )}

        <div className="min-w-0 flex-1">
          <ol className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-ink">
            <Step n={1}>
              Buka e-wallet atau m-banking, pilih <b>Scan / Bayar</b>. Pesan dari HP ini? Simpan
              gambar QRIS-nya, lalu pilih dari galeri.
            </Step>
            <Step n={2}>
              Bayar <b className="tabular-nums">{formatRupiah(totalAmount)}</b>, pas sesuai total.
            </Step>
            <Step n={3}>Screenshot bukti bayarnya, lalu unggah di bawah ini.</Step>
          </ol>

          <ProofUpload
            orderNumber={orderNumber}
            totalAmount={totalAmount}
            hasPaymentProof={hasPaymentProof}
            phoneLast4={phoneLast4}
            onProofSent={onProofSent}
          />
        </div>
      </div>
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-pink-soft text-[12px] font-bold text-pink-deep"
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

const subscribeNever = () => () => {};

/** The digits this device remembered for this order, if it did. */
function useRememberedDigits(orderNumber: string): string | null {
  const raw = React.useSyncExternalStore(
    subscribeNever,
    () => {
      try {
        return window.localStorage.getItem(REMEMBERED_ORDER_KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const remembered = parseRememberedOrder(raw);
  return remembered?.orderNumber === orderNumber ? remembered.phoneLast4 : null;
}

function ProofUpload({
  orderNumber,
  totalAmount,
  hasPaymentProof,
  phoneLast4,
  onProofSent,
}: {
  orderNumber: string;
  totalAmount: number;
  hasPaymentProof: boolean;
  phoneLast4?: string;
  onProofSent?: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const remembered = useRememberedDigits(orderNumber);
  const known = phoneLast4 ?? remembered;
  const [typed, setTyped] = React.useState("");
  // Sent from here, or already on record (from another device, or before a reload).
  const [sentHere, setSentHere] = React.useState(false);
  const sent = sentHere || hasPaymentProof;
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  const digits = known ?? typed;

  const upload = async (file: File) => {
    if (!/^\d{4}$/.test(digits)) {
      setError("Isi 4 digit terakhir nomor WhatsApp kamu dulu ya");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const shrunk = await shrinkImage(file, { maxEdge: 1600, type: "image/jpeg", quality: 0.82 });
      const form = new FormData();
      form.append("no", orderNumber);
      form.append("wa", digits);
      form.append("file", shrunk, "bukti.jpg");
      const response = await fetch("/api/bukti-bayar", { method: "POST", body: form });
      const result = (await response.json()) as ActionResult<{ url: string }>;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSentHere(true);
      toast("Bukti bayarnya udah terkirim!");
      if (onProofSent) onProofSent();
      else router.refresh();
    } catch {
      setError("Gagal mengunggah. Cek sinyal, lalu coba lagi ya");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="mt-5 border-t border-line pt-4">
      {sent ? (
        <div>
          <p role="status" className="rounded-[14px] bg-sky-soft p-3 text-[13.5px] leading-relaxed text-sky-deep">
            <b>Bukti bayar udah terkirim.</b> Kasir lagi ngecek pembayarannya; status di sini berubah
            jadi Lunas sendiri.
          </p>
          <ChatLink
            intent={{ kind: "payment", order: { orderNumber, totalAmount } }}
            look="quiet"
            className="mt-1 text-[13px]"
          >
            Lama belum Lunas? Chat kami
          </ChatLink>
        </div>
      ) : (
        <p className="text-[13px] text-ink-soft">Udah bayar? Kirim buktinya biar kasir cepat ngecek.</p>
      )}

      {!known && (
        <label className="mt-3 block">
          <span className="block text-[12.5px] font-semibold text-ink">4 digit terakhir WhatsApp kamu</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={typed}
            onChange={(event) => setTyped(event.target.value.replace(/\D/g, "").slice(0, 4))}
            className="mt-1.5 h-12 w-32 rounded-[12px] border-[1.5px] border-line bg-white px-3 text-[16px] tracking-[0.3em] tabular-nums focus:border-pink"
          />
        </label>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[13px] font-medium text-hot">
          {error}
        </p>
      )}

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Pilih gambar bukti bayar QRIS"
        // Opened by the visible button; kept out of the Tab order so a keyboard
        // user meets one control, not two.
        tabIndex={-1}
        className="sr-only"
        id={`bukti-${orderNumber}`}
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button
        type="button"
        variant={sent ? "flat" : "primary"}
        fullWidth
        isLoading={busy}
        disabled={busy}
        onClick={() => input.current?.click()}
        className="mt-3"
      >
        {sent ? "Ganti bukti bayar" : "Unggah bukti bayar"}
      </Button>
    </div>
  );
}
