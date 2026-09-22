"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";
import type { ActionResult } from "@/lib/action-result";
import { formatThousands, parseCashInput, quickCashOptions } from "@/lib/cash";
import { cn, formatRupiah } from "@/lib/utils";
import type { PaymentMethod } from "@/types/order";

/** What the cashier settled on, once the sheet's own checks have passed. */
export interface PaymentSubmission {
  method: PaymentMethod;
  /** Cash handed over; null for QRIS. */
  cashReceived: number | null;
}

const DEFAULT_SUBMIT_LABELS: Readonly<Record<PaymentMethod, string>> = {
  CASH: "Simpan transaksi",
  QRIS: "Pembayaran QRIS masuk, simpan",
};

export interface PaymentSheetProps {
  /** What the till shows. The server prices the order again and has the last word. */
  total: number;
  qrisImageUrl: string | null;
  /**
   * Set when the order already carries a method — a preorder is paid the way
   * the customer chose at checkout, and offering to change it here would only
   * be a choice the cashier can get wrong. Left out, the cashier picks.
   */
  fixedMethod?: PaymentMethod;
  title?: string;
  submitLabels?: Readonly<Record<PaymentMethod, string>>;
  onClose: () => void;
  /**
   * Does whatever this payment means — ring up a sale, settle a preorder — and
   * hands back the action's result. The sheet only reports a failure; success
   * belongs to the caller, which is the one that knows what comes next.
   */
  onSubmit: (payment: PaymentSubmission) => Promise<ActionResult<unknown>>;
}

/**
 * The counter's payment sheet, shared by the on-the-spot till and the preorder
 * desk. Both take money the same way; only what happens afterwards differs.
 */
export function PaymentSheet({
  total,
  qrisImageUrl,
  fixedMethod,
  title = "Pembayaran",
  submitLabels = DEFAULT_SUBMIT_LABELS,
  onClose,
  onSubmit,
}: PaymentSheetProps) {
  const { toast } = useToast();

  const [chosenMethod, setChosenMethod] = React.useState<PaymentMethod>(fixedMethod ?? "CASH");
  const [cashText, setCashText] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const method = fixedMethod ?? chosenMethod;

  // A ref as well as the state: two quick taps can both fire before React has
  // re-rendered the disabled button, and a double tap here would ring the same
  // customer up twice.
  const inFlight = React.useRef(false);

  // Stable on purpose: Sheet re-runs its focus effect whenever `onClose`
  // changes identity, which would pull focus out of the cash input mid-typing.
  const closeUnlessSaving = React.useCallback(() => {
    if (!inFlight.current) onClose();
  }, [onClose]);

  const cash = parseCashInput(cashText);
  const change = cash === null ? null : cash - total;
  const quickOptions = quickCashOptions(total);

  const handleSave = async () => {
    if (inFlight.current) return;

    if (method === "CASH") {
      if (cash === null) {
        toast("Isi uang yang diterima dulu ya");
        return;
      }
      if (cash < total) {
        toast(`Uangnya kurang ${formatRupiah(total - cash)}`);
        return;
      }
    }

    inFlight.current = true;
    setIsSaving(true);

    const result = await onSubmit({
      method,
      cashReceived: method === "CASH" ? cash : null,
    });

    inFlight.current = false;
    setIsSaving(false);

    if (!result.ok) toast(result.error);
  };

  return (
    <Sheet open onClose={closeUnlessSaving} title={title}>
      <div className="flex flex-col gap-4 pb-2">
        <div className="text-center py-1">
          <div className="text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
            Total
          </div>
          <div className="font-[family-name:var(--font-display)] text-[40px] leading-tight font-semibold text-ink tabular-nums">
            {formatRupiah(total)}
          </div>
        </div>

        {fixedMethod === undefined ? (
          <div
            role="group"
            aria-label="Metode bayar"
            className="grid grid-cols-2 gap-1 p-1 bg-cream rounded-[14px]"
          >
            {(["CASH", "QRIS"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={method === option}
                disabled={isSaving}
                onClick={() => setChosenMethod(option)}
                className={cn(
                  "min-h-[44px] rounded-[11px] text-sm font-semibold transition-colors",
                  method === option
                    ? "bg-white text-pink-deep shadow-sm"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                {option === "CASH" ? "Tunai" : "QRIS"}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm font-semibold text-ink-soft">
            Metode bayar: {fixedMethod === "CASH" ? "Tunai" : "Transfer / QRIS"}
          </div>
        )}

        {method === "CASH" ? (
          <div className="flex flex-col gap-2.5">
            <label htmlFor="cash-received" className="text-sm font-medium text-ink">
              Uang diterima
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft font-semibold">
                Rp
              </span>
              <input
                id="cash-received"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={cashText}
                disabled={isSaving}
                onChange={(event) => {
                  const value = parseCashInput(event.target.value);
                  setCashText(value === null ? "" : formatThousands(value));
                }}
                className="w-full bg-white border-[1.5px] border-line rounded-[14px] min-h-[54px] pl-11 pr-4 text-ink text-[20px] font-semibold tabular-nums focus:border-pink"
              />
            </div>

            {quickOptions.length > 0 && (
              <div className="grid grid-cols-2 tablet:grid-cols-4 gap-2">
                {quickOptions.map((option) => (
                  <button
                    key={option.amount}
                    type="button"
                    disabled={isSaving}
                    onClick={() => setCashText(formatThousands(option.amount))}
                    className={cn(
                      "min-h-[44px] rounded-[12px] border-[1.5px] text-sm font-semibold transition-colors",
                      cash === option.amount
                        ? "bg-pink-soft border-pink text-pink-deep"
                        : "bg-white border-line text-ink hover:bg-cream",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {change !== null && (
              <div
                aria-live="polite"
                className={cn(
                  "flex justify-between items-baseline p-3 rounded-[14px] border",
                  change >= 0
                    ? "bg-ok-soft text-ok border-ok/20"
                    : "bg-hot-soft text-hot border-hot/20",
                )}
              >
                <span className="text-sm font-semibold">
                  {change >= 0 ? "Kembalian" : "Uangnya belum cukup"}
                </span>
                <b className="text-lg tabular-nums">
                  {change >= 0 ? formatRupiah(change) : `kurang ${formatRupiah(-change)}`}
                </b>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 items-center">
            {qrisImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrisImageUrl}
                alt="Kode QRIS booth"
                className="w-full max-w-[260px] aspect-square object-contain rounded-[14px] border border-line bg-white"
              />
            ) : (
              <Note variant="hot" className="w-full">
                Gambar QRIS belum diisi admin di Pengaturan.
              </Note>
            )}
            <Note variant="info" className="w-full">
              Tunjukkan QRIS ke pelanggan, lalu tekan tombol di bawah setelah notifikasi masuk
            </Note>
          </div>
        )}

        <Button variant="primary" fullWidth isLoading={isSaving} onClick={handleSave}>
          {isSaving ? "Menyimpan…" : submitLabels[method]}
        </Button>
      </div>
    </Sheet>
  );
}
