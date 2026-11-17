"use client";

import * as React from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
 * One product, up close: the picture large and alive (ice bobbing, steam off
 * what is made to order), then the name and price, what to expect, how many,
 * and one button that says what it will cost.
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
        {/* Full-bleed across the sheet's own padding. */}
        <div className="-mx-4 desktop:-mx-6 desktop:-mt-6">
          <ProductVisual
            product={product}
            live
            className="h-44 w-full p-5 min-[380px]:h-52 desktop:h-60 desktop:rounded-t-[22px]"
          />
        </div>

        <div className="mt-5 flex items-start justify-between gap-4">
          <h2 className="display-3 min-w-0 text-ink">{product.name}</h2>
          <span className="flex-none font-[family-name:var(--font-display)] text-[22px] font-semibold text-pink-deep tabular-nums">
            {formatRupiah(product.price)}
          </span>
        </div>

        {product.description && (
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{product.description}</p>
        )}

        <ul className="mt-4 grid grid-cols-2 gap-2 text-[12.5px]">
          <li className={cn("rounded-[14px] px-3 py-2.5", fresh ? "bg-warn-soft" : "bg-sky-soft")}>
            <span className={cn("block font-bold", fresh ? "text-warn" : "text-sky-deep")}>
              {fresh ? "Diracik dadakan" : "Siap ambil"}
            </span>
            <span className="text-ink-soft">
              {fresh ? "Dibikin pas kamu ambil" : "Udah siap, tinggal ambil"}
            </span>
          </li>
          <li className={cn("rounded-[14px] px-3 py-2.5", isLow ? "bg-hot-soft" : "bg-cream")}>
            <span className={cn("block font-bold", isLow ? "text-hot" : "text-ink")}>
              {isLow ? `Tinggal ${remaining} lagi` : `Sisa ${remaining} porsi`}
            </span>
            <span className="text-ink-soft">Stok kepotong tiap ada yang pesan</span>
          </li>
        </ul>

        <div className="mt-5 flex items-center justify-between gap-4 rounded-[18px] bg-cream p-2">
          <button
            type="button"
            aria-label="Kurangi"
            disabled={quantity <= 1}
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-white text-2xl text-ink shadow-sm transition-transform active:scale-90 disabled:opacity-40"
          >
            &minus;
          </button>

          <div className="text-center" aria-live="polite">
            <div key={quantity} className="nav-count-pop font-[family-name:var(--font-display)] text-3xl font-semibold text-ink tabular-nums">
              {quantity}
            </div>
            <div className="text-[11.5px] font-semibold text-ink-soft">porsi</div>
          </div>

          <button
            type="button"
            aria-label="Tambah"
            disabled={quantity >= max}
            onClick={() => setQuantity((current) => Math.min(max, current + 1))}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-pink-deep text-2xl text-white shadow-sm transition-transform active:scale-90 disabled:opacity-40"
          >
            +
          </button>
        </div>

        {quantity >= max && remaining > 0 && (
          <p className="mt-2 text-center text-xs text-ink-soft">Sisa stoknya tinggal segini, ya</p>
        )}

        {/* Stuck to the bottom of the sheet, so the one thing to press is never
            below the fold on a short phone. */}
        <div className="sticky bottom-0 -mx-4 mt-4 bg-white px-4 pt-2 desktop:-mx-0 desktop:px-0">
          <Button
            variant="primary"
            fullWidth
            onClick={(event) =>
              onAdd(product.id, quantity, event.currentTarget.getBoundingClientRect())
            }
            className="justify-between px-5"
          >
            <span>Masukin keranjang</span>
            <span className="tabular-nums">{formatRupiah(subtotal)}</span>
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
