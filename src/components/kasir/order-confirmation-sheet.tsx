"use client";

import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { Sheet } from "@/components/ui/sheet";
import { formatRupiah } from "@/lib/utils";
import type { OnsiteOrderReceipt } from "@/types/order-view";

const METHOD_LABEL: Record<OnsiteOrderReceipt["paymentMethod"], string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
};

export interface OrderConfirmationSheetProps {
  receipt: OnsiteOrderReceipt;
  /** Closes the sheet and starts the next customer from an empty bill. */
  onNext: () => void;
}

export function OrderConfirmationSheet({ receipt, onNext }: OrderConfirmationSheetProps) {
  return (
    // However the sheet is dismissed, the sale is already saved — so every way
    // out leads to the next customer rather than back to this bill.
    <Sheet open onClose={onNext} title="Transaksi tersimpan">
      <div className="flex flex-col gap-4 pb-2">
        <div className="text-center py-1">
          <div className="text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
            Nomor pesanan
          </div>
          <div className="font-[family-name:var(--font-display)] text-[44px] leading-tight font-semibold text-pink-deep tabular-nums">
            {receipt.orderNumber}
          </div>
        </div>

        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Total</dt>
            <dd className="font-semibold text-ink">{formatRupiah(receipt.totalAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Metode bayar</dt>
            <dd className="font-semibold text-ink">{METHOD_LABEL[receipt.paymentMethod]}</dd>
          </div>
          {receipt.cashReceived !== null && (
            <div className="flex justify-between">
              <dt className="text-ink-soft">Uang diterima</dt>
              <dd className="font-semibold text-ink">{formatRupiah(receipt.cashReceived)}</dd>
            </div>
          )}
        </dl>

        {receipt.change !== null && (
          <div className="flex justify-between items-baseline p-3 rounded-[14px] border bg-ok-soft text-ok border-ok/20">
            <span className="text-sm font-semibold">Kembalian</span>
            <b className="font-[family-name:var(--font-display)] text-2xl tabular-nums">
              {formatRupiah(receipt.change)}
            </b>
          </div>
        )}

        {receipt.status === "IN_QUEUE" ? (
          <Note variant="warn">
            {receipt.prepItemCount} item dikirim ke dapur. Kasih nomor {receipt.orderNumber} ke
            pelanggan, panggil pas siap.
          </Note>
        ) : (
          <Note variant="info">Semua item siap ambil. Serahkan sekarang juga ke pelanggan.</Note>
        )}

        <Button variant="primary" fullWidth onClick={onNext}>
          Lanjut pelanggan berikutnya
        </Button>
      </div>
    </Sheet>
  );
}
