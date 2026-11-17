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
import {
  bundleIdOf,
  bundleKey,
  bundlesAvailable,
  portionsUsed,
  type BundleComponent,
  type PublicBundle,
} from "@/lib/bundle";
import type { OnsiteOrderReceipt } from "@/types/order-view";
import { PaymentSheet, type PaymentSubmission } from "./payment-sheet";
import { OrderConfirmationSheet } from "./order-confirmation-sheet";

const ALL_FILTER = "Semua";
const BUNDLE_FILTER = "Paket hemat";
const NO_BUNDLES: PublicBundle[] = [];

/**
 * One line of the bill. `productId` is the line's key: a product's id, or a
 * paket's under the `paket:` prefix (`bundleKey`), the same convention the
 * customer cart uses.
 */
export interface BillLine {
  productId: string;
  quantity: number;
}

/** A bill line with what it is, what it costs, and how far it may go up. */
interface BillEntry extends BillLine {
  name: string;
  price: number;
  subtotal: number;
  /** The most this line may hold: what it has plus what the shelf still allows. */
  max: number;
  /** A paket's contents, for the cashier to bag. */
  contents: string | null;
}

export interface PosScreenProps {
  products: PublicProduct[];
  /** Pakets on sale; their chip and cards are left out when there are none. */
  bundles?: PublicBundle[];
  categories: string[];
  boothOpen: boolean;
  qrisImageUrl: string | null;
}

export function PosScreen({
  products,
  bundles = NO_BUNDLES,
  categories,
  boothOpen,
  qrisImageUrl,
}: PosScreenProps) {
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
        items: bill
          .filter((line) => !bundleIdOf(line.productId))
          .map((line) => ({ productId: line.productId, quantity: line.quantity })),
        bundles: bill.flatMap((line) => {
          const bundleId = bundleIdOf(line.productId);
          return bundleId ? [{ bundleId, quantity: line.quantity }] : [];
        }),
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

  const bundleById = React.useMemo(
    () => new Map(bundles.map((bundle) => [bundle.id, bundle])),
    [bundles],
  );

  const quantityOf = (key: string) => bill.find((line) => line.productId === key)?.quantity ?? 0;

  /**
   * Portions of each product the bill already takes, loose and inside every
   * paket on it. A paket and a loose item draw on the same shelf, so every cap
   * on this screen reads this one figure — the same arithmetic as the
   * customer cart (`portionsUsed` in `lib/bundle.ts`).
   */
  const used = React.useMemo(() => {
    const loose: { productId: string; quantity: number }[] = [];
    const inBundles: { quantity: number; components: readonly BundleComponent[] }[] = [];

    for (const line of bill) {
      const bundleId = bundleIdOf(line.productId);
      if (!bundleId) {
        loose.push(line);
        continue;
      }
      const bundle = bundleById.get(bundleId);
      if (bundle) inBundles.push({ quantity: line.quantity, components: bundle.items });
    }

    return portionsUsed(loose, inBundles);
  }, [bill, bundleById]);

  const productLeft = (productId: string) =>
    Math.max(0, (productById.get(productId)?.stock ?? 0) - (used.get(productId) ?? 0));

  const bundleLeft = (bundleId: string) => {
    const bundle = bundleById.get(bundleId);
    return bundle ? bundlesAvailable(bundle.items, productLeft) : 0;
  };

  /** How many more of a line the shelf allows. */
  const leftFor = (key: string) => {
    const bundleId = bundleIdOf(key);
    return bundleId ? bundleLeft(bundleId) : productLeft(key);
  };

  const remainingOf = (product: PublicProduct) => productLeft(product.id);

  const entries = bill.flatMap((line): BillEntry[] => {
    const bundleId = bundleIdOf(line.productId);

    if (bundleId) {
      const bundle = bundleById.get(bundleId);
      if (!bundle) return [];
      return [
        {
          ...line,
          name: bundle.name,
          price: bundle.price,
          subtotal: bundle.price * line.quantity,
          max: line.quantity + bundleLeft(bundleId),
          contents: bundle.items.map((item) => `${item.quantity}× ${item.name}`).join(", "),
        },
      ];
    }

    const product = productById.get(line.productId);
    if (!product) return [];
    return [
      {
        ...line,
        name: product.name,
        price: product.price,
        subtotal: product.price * line.quantity,
        max: line.quantity + productLeft(product.id),
        contents: null,
      },
    ];
  });

  const total = entries.reduce((sum, entry) => sum + entry.subtotal, 0);
  const itemCount = entries.reduce((sum, entry) => sum + entry.quantity, 0);

  /** Adds one of a line, product or paket. */
  const addLine = (key: string) =>
    setBill((current) => {
      const existing = current.find((line) => line.productId === key);

      return existing
        ? current.map((line) =>
            line.productId === key ? { ...line, quantity: line.quantity + 1 } : line,
          )
        : [...current, { productId: key, quantity: 1 }];
    });

  /** One tap, one item — no detail sheet. Speed is the point of this screen. */
  const addOne = (product: PublicProduct) => {
    if (remainingOf(product) <= 0) {
      toast(`${product.name} udah habis`);
      return;
    }

    addLine(product.id);
  };

  const addBundle = (bundle: PublicBundle) => {
    if (bundleLeft(bundle.id) <= 0) {
      // Name the product that is short, so the cashier can offer the rest loose.
      const short = bundle.items.find((item) => productLeft(item.productId) < item.quantity);
      toast(short ? `${bundle.name} nggak bisa: ${short.name} habis` : `${bundle.name} udah habis`);
      return;
    }

    addLine(bundleKey(bundle.id));
  };

  const step = (key: string, delta: number) => {
    const cap = quantityOf(key) + leftFor(key);

    setBill((current) =>
      current.flatMap((line) => {
        if (line.productId !== key) return [line];

        const next = Math.min(line.quantity + delta, cap);
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
      : filter === BUNDLE_FILTER
        ? []
        : products.filter((product) => product.categoryName === filter);

  const showBundles = bundles.length > 0 && (filter === ALL_FILTER || filter === BUNDLE_FILTER);
  const filters = [ALL_FILTER, ...categories, ...(bundles.length > 0 ? [BUNDLE_FILTER] : [])];

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
                {entry.contents && (
                  <span className="mr-1 rounded bg-warn-soft px-1 text-[10px] font-bold uppercase text-warn">
                    Paket
                  </span>
                )}
                {entry.name}
              </span>
              {entry.contents && (
                <span className="block text-xs text-ink-soft">Isi: {entry.contents}</span>
              )}
              <span className="block text-xs text-ink-soft">
                {formatRupiah(entry.price)} &times; {entry.quantity} ={" "}
                {formatRupiah(entry.subtotal)}
              </span>
            </span>

            <span className="flex items-center gap-1.5 flex-none">
              <button
                type="button"
                aria-label={`Kurangi ${entry.name}`}
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
                aria-label={`Tambah ${entry.name}`}
                disabled={entry.quantity >= entry.max}
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
          {filters.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-4 px-4 tablet:mx-0 tablet:px-0 tablet:flex-wrap">
              {filters.map((name) => (
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

          {visible.length === 0 && !showBundles ? (
            <EmptyState emoji="🍽️" title="Nggak ada menu di kategori ini" />
          ) : visible.length === 0 ? null : (
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

          {showBundles && (
            <section aria-labelledby="pos-bundles" className={cn(visible.length > 0 && "mt-5")}>
              <h2 id="pos-bundles" className="mb-2.5 text-sm font-semibold text-ink">
                Paket hemat
              </h2>
              <div className="grid grid-cols-1 tablet:grid-cols-2 gap-2.5">
                {bundles.map((bundle) => {
                  const key = bundleKey(bundle.id);
                  const left = bundleLeft(bundle.id);
                  const inBill = quantityOf(key);
                  const isOut = left <= 0;

                  return (
                    <button
                      key={bundle.id}
                      type="button"
                      aria-disabled={isOut}
                      onClick={() => addBundle(bundle)}
                      aria-label={`Tambah ${bundle.name}`}
                      className={cn(
                        "relative flex min-h-[72px] flex-col gap-1 rounded-[16px] border-[1.5px] bg-white p-2.5 text-left transition-colors",
                        isOut
                          ? "cursor-not-allowed border-line opacity-50"
                          : "border-line hover:border-pink active:bg-pink-soft",
                      )}
                    >
                      {inBill > 0 && (
                        <span className="absolute -top-2 -right-2 flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-pink-deep px-1.5 text-xs font-bold text-white">
                          {inBill}
                        </span>
                      )}
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-semibold leading-tight text-ink">
                          {bundle.name}
                        </span>
                        <span className="flex-none text-xs font-semibold text-pink-deep">
                          {formatRupiah(bundle.price)}
                        </span>
                      </span>
                      <span className="text-xs leading-snug text-ink-soft">
                        {bundle.items.map((item) => `${item.quantity}× ${item.name}`).join(", ")}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] font-semibold",
                          isOut ? "text-hot" : "text-ink-soft",
                        )}
                      >
                        {isOut ? "isinya habis" : `bisa ${left} paket lagi`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
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
