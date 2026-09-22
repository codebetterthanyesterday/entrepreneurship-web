"use client";

import * as React from "react";
import { cn, formatRupiah } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FoodArt, foodKindOf } from "./journey-art";
import type { PublicProduct } from "@/types/admin";

export interface ProductCardProps {
  product: PublicProduct;
  /** Stock left after what is already in the cart. */
  remaining: number;
  onSelect: (product: PublicProduct) => void;
}

/**
 * One line of the menu.
 *
 * It used to be a bordered white card, and a column of those is the pattern that
 * made the whole site read as a template. It is a row on a hairline now — the
 * same grammar as the numbered advantages and the leader-dot menu on the profile
 * page — with the price set against the name, which is how a printed menu does it
 * and how prices are actually scanned.
 *
 * The horizontal shape stays. A photo grid would look better and work worse: a
 * menu where stock runs out during the event has to show the name, the price, the
 * prep type and what is left, and that is a row, not a tile.
 */
export function ProductCard({ product, remaining, onSelect }: ProductCardProps) {
  const isOut = remaining <= 0;
  const isLow = !isOut && remaining <= 3;

  return (
    <button
      type="button"
      disabled={isOut}
      onClick={() => onSelect(product)}
      aria-label={isOut ? `${product.name}, habis` : `Lihat ${product.name}`}
      className={cn(
        "group flex w-full items-start gap-4 border-t border-line py-4 text-left",
        isOut ? "cursor-default opacity-50" : "cursor-pointer",
      )}
    >
      <ProductVisual
        product={product}
        dimmed={isOut}
        className="h-[84px] w-[84px] rounded-[18px]"
      />

      <span className="flex-1 min-w-0">
        <span className="flex items-baseline gap-3">
          <span
            className={cn(
              "flex-1 min-w-0 truncate text-[16px] font-semibold text-ink transition-colors",
              !isOut && "group-hover:text-pink-deep",
            )}
          >
            {product.name}
          </span>
          {/* Tabular figures so a column of prices lines up on the decimal. */}
          <span className="flex-none text-[15px] font-semibold text-ink tabular-nums">
            {formatRupiah(product.price)}
          </span>
        </span>

        {product.description && (
          <span className="mt-1 block text-[13px] leading-snug text-ink-soft line-clamp-2">
            {product.description}
          </span>
        )}

        <span className="mt-2.5 flex flex-wrap items-center gap-2.5">
          <Badge variant={product.prepType === "NEEDS_PREP" ? "prep" : "info"}>
            {product.prepType === "NEEDS_PREP" ? "Diracik dadakan" : "Siap ambil"}
          </Badge>
          <span className={cn("eyebrow", isOut || isLow ? "text-hot" : "text-ink-soft")}>
            {isOut ? "Habis, maaf ya" : `Sisa ${remaining} porsi`}
          </span>
        </span>
      </span>
    </button>
  );
}

/**
 * The picture, or a stand-in for it — shared by the menu row, the product sheet
 * and the cart's lines, so a product looks the same wherever it appears.
 *
 * Most products have no `imageUrl` — there is no upload pipeline in this project,
 * only URLs an admin pastes in — so the no-image case is the common one and has
 * to look deliberate. It is drawn: a cup for a drink, a doughnut for the rest,
 * on the soft accent (see `foodKindOf`).
 */
export function ProductVisual({
  product,
  className,
  dimmed,
}: {
  product: Pick<PublicProduct, "name" | "imageUrl" | "categoryName">;
  className?: string;
  /** Sold out: the picture goes quiet with the rest of the row. */
  dimmed?: boolean;
}) {
  if (product.imageUrl) {
    return (
      // The frame clips; the image inside it is what scales. Putting
      // `overflow-hidden` and `scale` on the same element clips nothing, because
      // an element's own overflow never contains its own transform.
      <span className={cn("block flex-none overflow-hidden", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt=""
          loading="lazy"
          className={cn(
            "h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none",
            !dimmed && "group-hover:scale-[1.04]",
          )}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        // Padding in fixed units: a percentage resolves against the *parent's*
        // width, which on a wide row ate the whole tile and left the art 0×0.
        "food-tile flex flex-none items-center justify-center bg-pink-soft p-3",
        className,
      )}
    >
      <FoodArt kind={foodKindOf(product)} />
    </span>
  );
}
