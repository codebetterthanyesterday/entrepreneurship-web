"use client";

import * as React from "react";
import { Sheet } from "@/components/ui/sheet";
import { cn, formatRupiah } from "@/lib/utils";
import { ProductVisual } from "./product-card";
import type { PublicProduct } from "@/types/admin";

export interface ProductDetailSheetProps {
  product: PublicProduct;
  /** Stock left after what is already in the cart — the cap for this sheet. */
  remaining: number;
  onClose: () => void;
  /** `origin` is the add button's box, for the flight to the cart. */
  onAdd: (productId: string, quantity: number, origin?: DOMRect) => void;
}

/**
 * One product, up close — the design's "item quick view": the name, the
 * picture with its badges, how it is made and how many are left, a large
 * quantity control, and one button that says what it will cost.
 *
 * It rises from the bottom edge on a phone and sits in the middle of the
 * screen from the desktop breakpoint up; that part is `Sheet`'s, and the frame
 * around it is `.ui-sheet` in `kingdom.css`.
 */
export function ProductDetailSheet({
  product,
  remaining,
  onClose,
  onAdd,
}: ProductDetailSheetProps) {
  const max = Math.max(1, remaining);
  const [quantity, setQuantity] = React.useState(1);

  const subtotal = product.price * quantity;
  const isLow = remaining > 0 && remaining <= 3;
  const fresh = product.prepType === "NEEDS_PREP";

  return (
    <Sheet open onClose={onClose} ariaLabel={product.name}>
      <div className="flex flex-col pb-2">
        <div className="flex items-start justify-between gap-3">
          <span className="k-pill k-pill-yellow mt-2">★ Item quick view</span>
          <button type="button" onClick={onClose} aria-label="Tutup" className="k-close">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <h2 className="k-sheet-title mt-2 text-ink">{product.name}</h2>
        {product.description && (
          <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{product.description}</p>
        )}

        <div className="relative mt-3 overflow-hidden rounded-[16px]">
          <ProductVisual
            product={product}
            live
            className="h-40 w-full min-[380px]:h-48 desktop:h-52"
          />
          <div className="absolute left-2.5 top-2.5 flex gap-1.5">
            {isLow && <span className="k-pill">Hot item</span>}
            <span className="k-pill k-pill-yellow">{product.categoryName ?? "Menu"}</span>
          </div>
        </div>

        <div className="k-stock mt-3">
          <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-extrabold uppercase text-ink">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 flex-none rounded-full bg-[var(--k-grass)]"
            />
            {fresh ? "Diracik dadakan" : "Siap ambil"}
          </span>
          <span className={cn("flex-none text-[13.5px] font-bold", isLow ? "text-hot" : "text-warn")}>
            {isLow ? "Tinggal" : "Sisa"}{" "}
            <span className="k-tag k-tag-yellow k-tag-flat !text-[12px]">{remaining} porsi</span>
          </span>
        </div>

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
            <div className="text-[12px] font-bold text-ink-soft">porsi</div>
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

        {quantity >= max && remaining > 0 && (
          <p className="mt-2 text-center text-xs text-ink-soft">Sisa stoknya tinggal segini, ya</p>
        )}

        {/* Stuck to the bottom of the sheet, so the one thing to press is never
            below the fold on a short phone. */}
        <div className="sticky bottom-0 -mx-4 mt-3 bg-white px-4 pb-2 pt-2 desktop:-mx-0 desktop:px-0">
          <button
            type="button"
            className="k-add"
            onClick={(event) =>
              onAdd(product.id, quantity, event.currentTarget.getBoundingClientRect())
            }
          >
            <span>Masukin keranjang</span>
            <span className="k-add-price tabular-nums">{formatRupiah(subtotal)}</span>
          </button>
        </div>
      </div>
    </Sheet>
  );
}
