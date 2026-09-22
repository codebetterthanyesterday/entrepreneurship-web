"use client";

import * as React from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatRupiah } from "@/lib/utils";
import type { PublicProduct } from "@/types/admin";

export interface ProductDetailSheetProps {
  product: PublicProduct;
  /** Stock left after what is already in the cart — the cap for this sheet. */
  remaining: number;
  onClose: () => void;
  onAdd: (productId: string, quantity: number) => void;
}

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

  return (
    <Sheet open onClose={onClose} title={product.name}>
      <div className="flex flex-col gap-4 pb-2">
        {product.description && <p className="text-sm text-ink-soft -mt-1">{product.description}</p>}

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={product.prepType === "NEEDS_PREP" ? "prep" : "info"}>
            {product.prepType === "NEEDS_PREP" ? "Diracik dadakan" : "Siap ambil"}
          </Badge>
          <span
            className={cn("text-[11.5px] font-semibold", isLow ? "text-hot" : "text-ink-soft")}
          >
            Sisa {remaining} porsi
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 bg-cream rounded-[16px] p-3">
          <button
            type="button"
            aria-label="Kurangi"
            disabled={quantity <= 1}
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            className="w-[52px] h-[52px] flex items-center justify-center rounded-[14px] bg-white border-[1.5px] border-line text-ink-soft text-xl hover:border-pink hover:text-pink-deep disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-soft transition-colors"
          >
            &minus;
          </button>

          <div className="text-center">
            <div className="text-3xl font-semibold text-ink tabular-nums">{quantity}</div>
            <div className="text-[11.5px] font-semibold text-ink-soft">porsi</div>
          </div>

          <button
            type="button"
            aria-label="Tambah"
            disabled={quantity >= max}
            onClick={() => setQuantity((current) => Math.min(max, current + 1))}
            className="w-[52px] h-[52px] flex items-center justify-center rounded-[14px] bg-white border-[1.5px] border-line text-ink text-xl hover:border-pink hover:text-pink-deep disabled:opacity-40 disabled:hover:border-line transition-colors"
          >
            +
          </button>
        </div>

        {quantity >= max && remaining > 0 && (
          <p className="text-xs text-ink-soft text-center -mt-2">
            Sisa stoknya tinggal segini, ya
          </p>
        )}

        <Button
          variant="primary"
          fullWidth
          onClick={() => onAdd(product.id, quantity)}
          className="flex-col gap-0.5 py-2"
        >
          <span>Masukin keranjang</span>
          <span className="text-xs font-normal opacity-90">{formatRupiah(subtotal)}</span>
        </Button>
      </div>
    </Sheet>
  );
}
