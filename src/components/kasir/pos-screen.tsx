"use client";

import * as React from "react";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/use-toast";
import { submitOnsiteOrderAction } from "@/actions/order.actions";
import { cn, formatRupiah } from "@/lib/utils";
import type { PublicProduct } from "@/types/admin";
import type { OnsiteOrderReceipt } from "@/types/order-view";
import { PaymentSheet, type PaymentSubmission } from "./payment-sheet";
import { OrderConfirmationSheet } from "./order-confirmation-sheet";

const ALL_FILTER = "Semua";

export interface BillLine {
  productId: string;
  quantity: number;
}

export interface PosScreenProps {
  products: PublicProduct[];
  categories: string[];
  boothOpen: boolean;
  qrisImageUrl: string | null;
}

export function PosScreen({ products, categories, boothOpen, qrisImageUrl }: PosScreenProps) {
  const { toast } = useToast();

  // Kept in component memory on purpose — a cashier's transaction always starts
  // from nothing. Persisting it would let a half-finished bill from an earlier
  // shift reappear behind the next customer.
  const [bill, setBill] = React.useState<BillLine[]>([]);
  const [filter, setFilter] = React.useState(ALL_FILTER);
  const [billSheetOpen, setBillSheetOpen] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [receipt, setReceipt] = React.useState<OnsiteOrderReceipt | null>(null);

  const closePayment = React.useCallback(() => setPayOpen(false), []);

  /**
   * Rings the bill up. Only the products and quantities go over the wire — the
   * channel, the payment status and every rupiah are the server's to decide.
   */
  const ringUp = React.useCallback(
    async (payment: PaymentSubmission) => {
      const result = await submitOnsiteOrderAction({
        items: bill.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        paymentMethod: payment.method,
        cashReceived: payment.cashReceived,
      });

      if (result.ok) {
        setPayOpen(false);
        setReceipt(result.data);
      }

      return result;
    },
    [bill],
  );

  /** The sale is saved; the next customer starts from an empty bill. */
  const startNextCustomer = React.useCallback(() => {
    setReceipt(null);
    setBill([]);
    setBillSheetOpen(false);
  }, []);

  const productById = React.useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const quantityOf = (productId: string) =>
    bill.find((line) => line.productId === productId)?.quantity ?? 0;

  const remainingOf = (product: PublicProduct) =>
    Math.max(0, product.stock - quantityOf(product.id));

  const entries = bill.flatMap((line) => {
    const product = productById.get(line.productId);
    return product ? [{ ...line, product, subtotal: product.price * line.quantity }] : [];
  });

  const total = entries.reduce((sum, entry) => sum + entry.subtotal, 0);
  const itemCount = entries.reduce((sum, entry) => sum + entry.quantity, 0);

  /** One tap, one item — no detail sheet. Speed is the point of this screen. */
  const addOne = (product: PublicProduct) => {
    if (remainingOf(product) <= 0) {
      toast(`${product.name} udah habis`);
      return;
    }

    setBill((current) => {
      const existing = current.find((line) => line.productId === product.id);

      return existing
        ? current.map((line) =>
            line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line,
          )
        : [...current, { productId: product.id, quantity: 1 }];
    });
  };

  const step = (productId: string, delta: number) => {
    const product = productById.get(productId);
    if (!product) return;

    setBill((current) =>
      current.flatMap((line) => {
        if (line.productId !== productId) return [line];

        const next = Math.min(line.quantity + delta, product.stock);
        return next <= 0 ? [] : [{ ...line, quantity: next }];
      }),
    );
  };

  const clearBill = () => {
    setBill([]);
    setBillSheetOpen(false);
  };

  const visible =
    filter === ALL_FILTER
      ? products
      : products.filter((product) => product.categoryName === filter);

  const payDisabled = bill.length === 0 || !boothOpen;

  const billRows =
    entries.length === 0 ? (
      <p className="text-sm text-ink-soft py-4">Ketuk menu di sebelah buat nambah item.</p>
    ) : (
      <ul className="flex flex-col gap-2.5">
        {entries.map((entry) => (
          <li key={entry.productId} className="flex items-center gap-2">
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] font-semibold text-ink truncate">
                {entry.product.name}
              </span>
              <span className="block text-xs text-ink-soft">
                {formatRupiah(entry.product.price)} &times; {entry.quantity} ={" "}
                {formatRupiah(entry.subtotal)}
              </span>
            </span>

            <span className="flex items-center gap-1.5 flex-none">
              <button
                type="button"
                aria-label={`Kurangi ${entry.product.name}`}
                onClick={() => step(entry.productId, -1)}
                className="w-[44px] h-[44px] flex items-center justify-center rounded-xl border-[1.5px] border-line bg-white text-ink-soft hover:bg-cream hover:text-ink transition-colors"
              >
                &minus;
              </button>

              <span className="min-w-[24px] text-center text-sm font-semibold text-ink tabular-nums">
                {entry.quantity}
              </span>

              <button
                type="button"
                aria-label={`Tambah ${entry.product.name}`}
                disabled={entry.quantity >= entry.product.stock}
                onClick={() => step(entry.productId, 1)}
                className="w-[44px] h-[44px] flex items-center justify-center rounded-xl border-[1.5px] border-line bg-white text-ink hover:bg-cream disabled:opacity-40 disabled:hover:bg-white transition-colors"
              >
                +
              </button>
            </span>
          </li>
        ))}
      </ul>
    );

  const billFooter = (
    <>
      <div className="flex justify-between items-baseline border-t-[1.5px] border-dashed border-line mt-3 pt-3">
        <span className="font-bold text-[15.5px] text-ink">Total</span>
        <span className="font-bold text-[15.5px] text-ink">{formatRupiah(total)}</span>
      </div>

      <div className="flex gap-2 mt-3.5">
        <Button
          variant="flat"
          size="sm"
          className="px-4"
          disabled={bill.length === 0}
          onClick={clearBill}
        >
          Kosongkan
        </Button>

        <Button
          variant="primary"
          size="sm"
          fullWidth
          aria-expanded={payOpen}
          disabled={payDisabled}
          onClick={() => {
            setBillSheetOpen(false);
            setPayOpen(true);
          }}
        >
          Bayar
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col">
      {!boothOpen && (
        <div
          role="status"
          className="bg-warn-soft text-warn text-sm font-medium p-3 rounded-[14px] border border-warn/20 mb-4"
        >
          Booth ditutup admin. Kasir belum bisa simpan pesanan baru.
        </div>
      )}

      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0">
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-4 px-4 tablet:mx-0 tablet:px-0 tablet:flex-wrap">
              {[ALL_FILTER, ...categories].map((name) => (
                <Chip
                  key={name}
                  active={filter === name}
                  aria-pressed={filter === name}
                  onClick={() => setFilter(name)}
                  className="flex-none"
                >
                  {name}
                </Chip>
              ))}
            </div>
          )}

          {visible.length === 0 ? (
            <EmptyState emoji="🍽️" title="Nggak ada menu di kategori ini" />
          ) : (
            <div className="grid grid-cols-2 tablet:grid-cols-3 gap-2.5">
              {visible.map((product) => {
                const remaining = remainingOf(product);
                const inBill = quantityOf(product.id);
                const isOut = remaining <= 0;
                const showPrepDot = product.prepType === "NEEDS_PREP" && inBill === 0;

                return (
                  <button
                    key={product.id}
                    type="button"
                    // Not `disabled`: a tap on a sold-out card still has to be
                    // able to say why nothing happened.
                    aria-disabled={isOut}
                    onClick={() => addOne(product)}
                    aria-label={`Tambah ${product.name}`}
                    className={cn(
                      "relative flex items-center gap-2.5 min-h-[72px] p-2.5 rounded-[16px] border-[1.5px] bg-white text-left transition-colors",
                      isOut
                        ? "opacity-50 cursor-not-allowed border-line"
                        : "border-line hover:border-pink active:bg-pink-soft",
                    )}
                  >
                    {inBill > 0 ? (
                      <span className="absolute -top-2 -right-2 min-w-[26px] h-[26px] px-1.5 rounded-full bg-pink-deep text-white text-xs font-bold flex items-center justify-center">
                        {inBill}
                      </span>
                    ) : (
                      showPrepDot && (
                        <span
                          aria-hidden="true"
                          title="Perlu diracik"
                          className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-warn"
                        />
                      )
                    )}

                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt=""
                        className="w-[42px] h-[42px] rounded-[11px] object-cover flex-none"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="w-[42px] h-[42px] rounded-[11px] bg-pink-soft text-pink-deep flex items-center justify-center text-base font-semibold flex-none"
                      >
                        {product.name.charAt(0).toUpperCase()}
                      </span>
                    )}

                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold text-ink leading-tight line-clamp-2">
                        {product.name}
                      </span>
                      <span className="block text-xs text-ink-soft mt-0.5">
                        {formatRupiah(product.price)}
                      </span>
                      <span
                        className={cn(
                          "block text-[11px] font-semibold",
                          isOut ? "text-hot" : "text-ink-soft",
                        )}
                      >
                        {isOut ? "habis" : `sisa ${remaining}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="hidden desktop:block sticky top-[calc(var(--page-top)+1rem)] self-start w-[300px] flex-none">
          <div className="bg-white border-[1.5px] border-line rounded-[18px] p-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink mb-3">
              Bill sekarang
            </h2>
            {billRows}
            {billFooter}
          </div>
        </aside>
      </div>

      <div className="desktop:hidden sticky bottom-[var(--nav-bar-height)] -mx-4 mt-4 px-4 pt-3 pb-[var(--action-bar-inset)] bg-white border-t border-line z-10">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-ink-soft">
              {itemCount === 0 ? "Belum ada item" : `${itemCount} item`}
            </div>
            <b className="text-[15px] text-ink">{formatRupiah(total)}</b>
          </div>

          <Button
            variant="flat"
            size="sm"
            className="px-4"
            disabled={bill.length === 0}
            onClick={() => setBillSheetOpen(true)}
          >
            Rincian
          </Button>

          <Button
            variant="primary"
            size="sm"
            className="px-5"
            aria-expanded={payOpen}
            disabled={payDisabled}
            onClick={() => setPayOpen(true)}
          >
            Bayar
          </Button>
        </div>
      </div>

      {billSheetOpen && (
        <Sheet open onClose={() => setBillSheetOpen(false)} title="Rincian bill">
          <div className="pb-2">
            <p className="text-sm text-ink-soft -mt-1 mb-3">Ketuk &minus; atau + buat ubah jumlah</p>
            {billRows}
            {billFooter}
          </div>
        </Sheet>
      )}

      {payOpen && (
        <PaymentSheet
          total={total}
          qrisImageUrl={qrisImageUrl}
          onClose={closePayment}
          onSubmit={ringUp}
        />
      )}

      {receipt && <OrderConfirmationSheet receipt={receipt} onNext={startNextCustomer} />}
    </div>
  );
}
