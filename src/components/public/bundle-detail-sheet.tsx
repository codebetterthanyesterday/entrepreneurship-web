"use client";

import * as React from "react";
import { Sheet } from "@/components/ui/sheet";
import { cn, formatRupiah } from "@/lib/utils";
import { bundleSaving, type PublicBundle } from "@/lib/bundle";
import { BundleVisual } from "./bundle-visual";

export interface BundleDetailSheetProps {
  bundle: PublicBundle;
  /** Pakets left after what is already in the cart: the cap for this sheet. */
  remaining: number;
  preorderOpen: boolean;
  onClose: () => void;
  /** `origin` is the add button's box, for the flight to the cart. */
  onAdd: (bundleId: string, quantity: number, origin?: DOMRect) => void;
}

/**
 * One paket, up close, opened by a tap anywhere on its card: the picture
 * large, what is in it, what it saves, how many are left, a quantity control
 * and one button that says what it will cost. The paket's version of
 * `ProductDetailSheet`, in the same frame.
 */
export function BundleDetailSheet({ bundle, remaining, preorderOpen, onClose, onAdd }: BundleDetailSheetProps) {
  const max = Math.max(1, remaining);
  const [quantity, setQuantity] = React.useState(1);

  const saving = bundleSaving(bundle);
  const isLow = remaining > 0 && remaining <= 3;
  const canAdd = preorderOpen && remaining > 0;

  return (
    <Sheet open onClose={onClose} ariaLabel={bundle.name}>
      <div className="flex flex-col pb-2">
        <div className="flex items-start justify-between gap-3">
          <span className="k-pill k-pill-yellow mt-2">✪ Combo quick view</span>
          <button type="button" onClick={onClose} aria-label="Tutup" className="k-close">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <h2 className="k-sheet-title mt-2 text-ink">{bundle.name}</h2>
        {bundle.description && (
          <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{bundle.description}</p>
        )}

        <BundleVisual
          bundle={bundle}
          dimmed={remaining <= 0}
          className="mt-3 aspect-[16/9] w-full overflow-hidden rounded-[16px]"
        />

        <section aria-labelledby="bundle-contents" className="mt-3">
          <h3 id="bundle-contents" className="k-mono text-[11px] text-ink-soft">
            Isi paket
          </h3>
          <ul className="mt-1.5 flex flex-col">
            {bundle.items.map((item) => (
              <li
                key={item.productId}
                className="flex justify-between gap-3 border-t border-line py-2 text-[14px] text-ink"
              >
                <span className="min-w-0">
                  <span className="font-semibold tabular-nums">{item.quantity}&times;</span> {item.name}
                </span>
                <span className="flex-none text-[12.5px] text-ink-soft">
                  {item.prepType === "NEEDS_PREP" ? "Diracik dadakan" : "Siap ambil"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="k-stock mt-3">
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[13.5px] font-extrabold text-ink">
            {saving > 0 && (
              <s className="k-mono text-[11px] font-normal text-ink-soft">{formatRupiah(bundle.normalPrice)}</s>
            )}
            <span className="tabular-nums text-pink-deep">{formatRupiah(bundle.price)}</span>
            {saving > 0 && (
              <span className="k-tag k-tag-yellow k-tag-flat !text-[11px]">Hemat {formatRupiah(saving)}</span>
            )}
          </span>
          <span className={cn("flex-none text-[13.5px] font-bold", isLow ? "text-hot" : "text-warn")}>
            {remaining <= 0 ? "Lagi habis" : `${isLow ? "Tinggal" : "Sisa"} ${remaining} paket`}
          </span>
        </div>

        {canAdd && (
          <div className="k-qty mt-3">
            <button
              type="button"
              aria-label="Kurangi"
              disabled={quantity <= 1}
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            >
              &minus;
            </button>

            <div className="text-center" aria-live="polite">
              <div key={quantity} className="nav-count-pop k-qty-figure tabular-nums">
                {quantity}
              </div>
              <div className="text-[12px] font-bold text-ink-soft">paket</div>
            </div>

            <button
              type="button"
              aria-label="Tambah"
              disabled={quantity >= max}
              onClick={() => setQuantity((current) => Math.min(max, current + 1))}
            >
              +
            </button>
          </div>
        )}

        {canAdd && quantity >= max && (
          <p className="mt-2 text-center text-xs text-ink-soft">Sisa paketnya tinggal segini, ya</p>
        )}

        {/* Stuck to the bottom of the sheet, so the one thing to press is never
            below the fold on a short phone. */}
        <div className="sticky bottom-0 -mx-4 mt-3 bg-white px-4 pb-2 pt-2 desktop:-mx-0 desktop:px-0">
          {canAdd ? (
            <button
              type="button"
              className="k-add"
              onClick={(event) => onAdd(bundle.id, quantity, event.currentTarget.getBoundingClientRect())}
            >
              <span>Masukin keranjang</span>
              <span className="k-add-price tabular-nums">{formatRupiah(bundle.price * quantity)}</span>
            </button>
          ) : (
            <p className="py-3 text-center text-sm font-semibold text-ink-soft">
              {preorderOpen ? "Isinya lagi habis" : "Preorder lagi ditutup"}
            </p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
