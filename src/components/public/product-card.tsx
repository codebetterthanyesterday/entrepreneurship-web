"use client";

import * as React from "react";
import { cn, formatRupiah } from "@/lib/utils";
import { flavorOf } from "@/lib/flavor";
import { FlavorArt } from "./flavor-art";
import type { PublicProduct } from "@/types/admin";

export interface ProductCardProps {
  product: PublicProduct;
  /** Stock left after what is already in the cart. */
  remaining: number;
  /** How many of it are in the cart already. */
  inCart: number;
  onSelect: (product: PublicProduct) => void;
  /** One more straight into the cart; `origin` is the button, for the flight. */
  onQuickAdd: (product: PublicProduct, origin: DOMRect) => void;
}

/**
 * One item on the menu: a tile, two to a row on a phone.
 *
 * The picture does the selling, so it takes the tile's full width. What a
 * customer needs to decide stays on the tile with it: the name, the price, the
 * prep type, and how many are left, which turns urgent at three.
 *
 * Two controls, side by side rather than nested: the tile opens the product's
 * sheet, and the round "+" on the picture adds one without opening anything,
 * which is how most people reorder the thing they already know.
 */
export function ProductCard({ product, remaining, inCart, onSelect, onQuickAdd }: ProductCardProps) {
  const isOut = product.stock <= 0;
  const isCapped = !isOut && remaining <= 0;
  const isLow = !isOut && remaining > 0 && remaining <= 3;
  const fresh = product.prepType === "NEEDS_PREP";

  return (
    <article className="relative">
      <button
        type="button"
        disabled={isOut}
        onClick={() => onSelect(product)}
        aria-label={isOut ? `${product.name}, habis` : `Lihat ${product.name}`}
        className={cn("group block w-full text-left", isOut ? "cursor-default" : "cursor-pointer")}
      >
        <span className="relative block aspect-square overflow-hidden rounded-[24px]">
          <ProductVisual product={product} dimmed={isOut} className="h-full w-full p-[14%]" />

          <span
            className={cn(
              "absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-wide",
              "bg-white/85 backdrop-blur-sm",
              fresh ? "text-warn" : "text-sky-deep",
            )}
          >
            {fresh ? "Diracik dadakan" : "Siap ambil"}
          </span>

          {isOut && (
            <span className="absolute inset-0 flex items-center justify-center bg-cream/55">
              <span className="-rotate-12 rounded-[10px] border-[3px] border-hot px-3 py-1 font-[family-name:var(--font-display)] text-[17px] font-semibold uppercase tracking-wider text-hot">
                Habis
              </span>
            </span>
          )}
        </span>

        <span className="mt-2.5 block px-0.5">
          <span
            className={cn(
              "block text-[14.5px] font-semibold leading-snug text-ink line-clamp-2 transition-colors tablet:text-[15.5px]",
              !isOut && "group-hover:text-pink-deep",
            )}
          >
            {product.name}
          </span>
          <span className="mt-1 flex items-baseline justify-between gap-2">
            <span className="font-[family-name:var(--font-display)] text-[17px] font-semibold text-ink tabular-nums">
              {formatRupiah(product.price)}
            </span>
          </span>
          <span
            className={cn(
              "mt-0.5 block text-[12px] font-semibold",
              isOut || isLow || isCapped ? "text-hot" : "text-ink-soft",
            )}
          >
            {isOut
              ? "Habis, maaf ya"
              : isCapped
                ? "Semua sisanya udah di keranjang"
                : isLow
                  ? `Tinggal ${remaining} lagi!`
                  : `Sisa ${remaining} porsi`}
          </span>
        </span>
      </button>

      {!isOut && (
        // Laid over the picture's corner, but a sibling of the tile's button:
        // a button inside a button is not a thing a screen reader can use.
        <span className="pointer-events-none absolute inset-x-0 top-0 aspect-square">
          <button
            type="button"
            disabled={isCapped}
            onClick={(event) => onQuickAdd(product, event.currentTarget.getBoundingClientRect())}
            aria-label={`Tambah 1 ${product.name} ke keranjang`}
            className={cn(
              "pointer-events-auto absolute bottom-2.5 right-2.5 flex h-11 w-11 items-center justify-center rounded-full",
              "bg-pink-deep text-white shadow-[0_8px_18px_-8px_var(--color-pink-deep)]",
              "transition-transform active:scale-90 disabled:bg-ink-soft disabled:shadow-none",
            )}
          >
            {inCart > 0 ? (
              <span key={inCart} className="nav-count-pop text-[15px] font-bold tabular-nums">
                {inCart}
              </span>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </span>
      )}
    </article>
  );
}

/**
 * The picture, or the drawing of it: shared by the menu's tiles, the product's
 * sheet and the cart's lines, so a product looks the same wherever it appears.
 *
 * Most products have no `imageUrl` (there is no upload pipeline, only URLs an
 * admin pastes in), so the drawing is the common case: `FlavorArt`, on a tile
 * washed in the colour of what is in it.
 */
export function ProductVisual({
  product,
  className,
  dimmed,
  live,
}: {
  product: Pick<PublicProduct, "name" | "imageUrl" | "categoryName"> &
    Partial<Pick<PublicProduct, "prepType">>;
  className?: string;
  /** Sold out: the picture goes quiet. */
  dimmed?: boolean;
  /** The product's own sheet: ice bobs, steam rises. */
  live?: boolean;
}) {
  if (product.imageUrl) {
    return (
      // The frame clips; the image inside it is what scales. Putting
      // `overflow-hidden` and `scale` on the same element clips nothing, because
      // an element's own overflow never contains its own transform.
      <span className={cn("block flex-none overflow-hidden !p-0", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt=""
          loading="lazy"
          className={cn(
            "h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none",
            dimmed ? "grayscale-[60%]" : "group-hover:scale-[1.05]",
          )}
        />
      </span>
    );
  }

  const { tint } = flavorOf(product);

  return (
    <span
      aria-hidden="true"
      className={cn("flex flex-none items-center justify-center", dimmed && "grayscale-[60%]", className)}
      style={{
        // A pool of light behind the item, the way a counter lamp falls.
        background: `radial-gradient(circle at 50% 38%, #ffffff 0%, ${tint} 62%)`,
      }}
    >
      <FlavorArt product={product} fresh={product.prepType === "NEEDS_PREP"} live={live} />
    </span>
  );
}
