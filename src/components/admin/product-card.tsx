"use client";

import * as React from "react";
import { cn, formatRupiah } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { AdminProduct } from "@/types/admin";

export interface ProductCardProps {
  product: AdminProduct;
  lowStockThreshold: number;
  onSelect: (product: AdminProduct) => void;
}

export function ProductCard({ product, lowStockThreshold, onSelect }: ProductCardProps) {
  const isOut = product.stock === 0;
  const isLow = !isOut && product.stock <= lowStockThreshold;

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      aria-label={`Ubah ${product.name}`}
      className={cn(
        "flex items-center gap-3 w-full text-left bg-white border-[1.5px] border-line rounded-[18px] p-3",
        "transition-colors hover:border-pink focus:border-pink",
        !product.isActive && "opacity-55",
      )}
    >
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt=""
          className="w-[46px] h-[46px] rounded-[13px] object-cover flex-none"
        />
      ) : (
        <span
          aria-hidden="true"
          className="w-[46px] h-[46px] rounded-[13px] bg-pink-soft text-pink-deep flex items-center justify-center text-lg font-semibold flex-none"
        >
          {product.name.charAt(0).toUpperCase()}
        </span>
      )}

      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-sm text-ink truncate">{product.name}</span>
        <span className="block text-xs font-medium text-ink-soft">
          {formatRupiah(product.price)} &middot; terjual {product.sold}
        </span>
        <span className="flex gap-1.5 mt-1.5 flex-wrap">
          <Badge variant={product.prepType === "NEEDS_PREP" ? "prep" : "info"}>
            {product.prepType === "NEEDS_PREP" ? "racik" : "siap"}
          </Badge>
          {isOut && <Badge variant="danger">habis</Badge>}
          {isLow && <Badge variant="danger">menipis</Badge>}
          {!product.isActive && <Badge variant="muted">disembunyikan</Badge>}
        </span>
      </span>

      <span
        className={cn(
          "text-2xl font-semibold tabular-nums flex-none",
          isOut ? "text-hot" : isLow ? "text-warn" : "text-ink",
        )}
      >
        {product.stock}
      </span>
    </button>
  );
}
