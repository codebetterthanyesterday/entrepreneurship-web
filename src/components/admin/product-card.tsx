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
        "s-slab flex items-center gap-3 w-full text-left p-2.5 transition-transform hover:-translate-y-0.5",
        !product.isActive && "opacity-60",
      )}
    >
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt=""
          className="w-[54px] h-[54px] rounded-[10px] object-cover flex-none"
        />
      ) : (
        <span aria-hidden="true" className="s-thumb w-[54px] h-[54px] text-[22px]">
          <span>{product.name.charAt(0).toUpperCase()}</span>
        </span>
      )}

      <span className="flex-1 min-w-0">
        <span className="block font-extrabold text-[15px] text-ink truncate">{product.name}</span>
        <span className="block text-[12.5px] font-medium text-ink-soft">
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
          "s-stock tabular-nums flex-none pr-1",
          isOut && "s-stock-out",
          isLow && "s-stock-low",
        )}
      >
        {product.stock}
        <small aria-hidden="true">STOK</small>
      </span>
    </button>
  );
}
