"use client";

import * as React from "react";
import { cn, formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
 * One item on the menu, as the design's card: the picture across the top with
 * its tags, the name beside its price, a line about it, and "Tambah".
 *
 * Mobile-first. Two cards share a row on a phone, so the phone's card is the
 * short version — picture, name, price, stock, button — and the description
 * and the category tag only appear from 640px up, where a card is wide enough
 * to hold them without pushing the button off the first screen.
 *
 * Two controls, one after the other rather than nested: the picture and name
 * open the product's sheet, and "Tambah" adds one without opening anything,
 * which is how most people reorder the thing they already know.
 */
export function ProductCard({ product, remaining, inCart, onSelect, onQuickAdd }: ProductCardProps) {
  const isOut = product.stock <= 0;
  const isCapped = !isOut && remaining <= 0;
  const isLow = !isOut && remaining > 0 && remaining <= 3;
  const fresh = product.prepType === "NEEDS_PREP";

  return (
    <article className="k-hard flex flex-col bg-white">
      <button
        type="button"
        disabled={isOut}
        onClick={() => onSelect(product)}
        aria-label={isOut ? `${product.name}, habis` : `Lihat ${product.name}`}
        className={cn(
          "group flex w-full flex-1 flex-col text-left",
          isOut ? "cursor-default" : "cursor-pointer",
        )}
      >
        <span className="relative block aspect-[4/3] w-full overflow-hidden tablet:aspect-[16/10]">
          <ProductVisual product={product} dimmed={isOut} className="h-full w-full" />

          <span className="k-tag k-tag-yellow absolute left-2 top-2 !text-[9.5px] tablet:!text-[10.5px]">
            {fresh ? "Diracik dadakan" : "Siap ambil"}
          </span>

          {product.categoryName && (
            // The wrapper does the hiding: `.k-tag` sets its own `display`, and
            // being unlayered CSS it would win over a `hidden` on the same node.
            <span className="absolute right-2 top-2 hidden tablet:block">
              <span className="k-tag">{product.categoryName}</span>
            </span>
          )}

          {isOut && (
            <span className="absolute inset-0 flex items-center justify-center bg-cream/55">
              <span className="-rotate-12 border-[3px] border-hot bg-white px-3 py-1 font-[family-name:var(--font-display)] text-[17px] font-extrabold uppercase tracking-wider text-hot">
                Habis
              </span>
            </span>
          )}
        </span>

        <span className="flex flex-1 flex-col gap-1.5 px-3 pt-3 tablet:px-4 tablet:pt-4">
          <span className="flex flex-col items-start gap-1.5 tablet:flex-row tablet:justify-between tablet:gap-3">
            <span
              className={cn(
                "font-[family-name:var(--font-display)] text-[14.5px] font-extrabold uppercase leading-tight text-ink line-clamp-2 transition-colors tablet:text-[18px]",
                !isOut && "group-hover:text-pink-deep",
              )}
            >
              {product.name}
            </span>
            <span className="k-price flex-none text-[14px] text-ink tabular-nums tablet:text-[17px]">
              <span aria-hidden="true" className="k-coin">
                $
              </span>
              {formatRupiah(product.price)}
            </span>
          </span>

          {product.description && (
            <span className="hidden text-[14px] leading-relaxed text-ink-soft tablet:line-clamp-3">
              {product.description}
            </span>
          )}

          <span
            className={cn(
              "mt-auto block pt-1 text-[12px] font-bold",
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

      {/* A sibling of the tile's button: a button inside a button is not a
          thing a screen reader can use. */}
      <div className="p-3 pt-2.5 tablet:p-4 tablet:pt-3">
        <Button
          size="sm"
          fullWidth
          disabled={isOut || isCapped}
          onClick={(event) => onQuickAdd(product, event.currentTarget.getBoundingClientRect())}
          aria-label={`Tambah 1 ${product.name} ke keranjang`}
        >
          Tambah
          {inCart > 0 && (
            <span key={inCart} className="nav-count-pop ml-1.5 tabular-nums">
              · {inCart}
            </span>
          )}
        </Button>
      </div>
    </article>
  );
}

/**
 * The picture, or the drawing of it: shared by the menu's cards, the product's
 * sheet and the cart's lines, so a product looks the same wherever it appears.
 *
 * A product without an `imageUrl` gets its drawing (`FlavorArt`) standing on
 * the kingdom's own scenery — sky above, a strip of pixel ground below — which
 * is the backdrop the team's product photos are shot against, so a drawn item
 * and a photographed one sit on the same shelf without one looking unfinished.
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

  return (
    <span
      aria-hidden="true"
      className={cn(
        "k-scene flex flex-none items-center justify-center",
        dimmed && "grayscale-[60%]",
        className,
      )}
    >
      <FlavorArt product={product} fresh={product.prepType === "NEEDS_PREP"} live={live} />
    </span>
  );
}
