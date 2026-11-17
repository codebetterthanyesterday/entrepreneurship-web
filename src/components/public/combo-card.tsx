"use client";

import * as React from "react";
import { cn, formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { bundleSaving, type PublicBundle } from "@/lib/bundle";
import { BundleVisual } from "./bundle-visual";

export interface ComboCardProps {
  bundle: PublicBundle;
  /** Which paket this is on the page, for its "Paket A / B" label. */
  index: number;
  /** How many more the stock allows, given what is already in the cart. */
  remaining: number;
  inCart: number;
  preorderOpen: boolean;
  onClaim: (bundle: PublicBundle, origin: DOMRect) => void;
}

/**
 * One "power-up combo" from the design: its label and size, the name, what is
 * in it, the pictures of its products, the normal price struck through beside
 * the paket price, and the button that puts it in the bag.
 *
 * The saving and the "-28%" corner are worked out from the products' current
 * prices, never typed in, so they cannot drift from the menu.
 */
export function ComboCard({ bundle, index, remaining, inCart, preorderOpen, onClaim }: ComboCardProps) {
  const saving = bundleSaving(bundle);
  const percent = bundle.normalPrice > 0 ? Math.round((saving / bundle.normalPrice) * 100) : 0;
  const portions = bundle.items.reduce((sum, item) => sum + item.quantity, 0);
  const label = `Paket ${String.fromCharCode(65 + (index % 26))}`;
  const accent = index % 2 === 1;
  const soldOut = remaining <= 0 && inCart === 0;

  return (
    <article className="k-hard relative flex flex-col overflow-hidden bg-white p-4 tablet:p-5">
      {percent > 0 && (
        <span aria-hidden="true" className={cn("k-combo-off", accent && "k-combo-off-red")}>
          -{percent}%
        </span>
      )}

      <p className="flex flex-wrap items-center gap-2 pr-14">
        <span className={cn("k-tag k-tag-flat", accent ? "k-tag-yellow" : "k-tag-red")}>{label}</span>
        <span className={cn("k-mono text-[10.5px]", accent ? "text-pink-deep" : "text-sky-deep")}>
          Combo {portions} item
        </span>
      </p>

      <h3 className="mt-2 font-[family-name:var(--font-display)] text-[20px] font-extrabold uppercase leading-tight text-ink">
        {bundle.name}
      </h3>
      <p className="mt-1 text-[14.5px] leading-relaxed text-ink-soft">
        {bundle.description ??
          bundle.items.map((item) => `${item.quantity} ${item.name}`).join(" + ")}
      </p>

      <BundleVisual bundle={bundle} dimmed={soldOut} className="mt-3.5 aspect-[16/7] w-full" />

      <div className="mt-3.5 flex flex-wrap items-end justify-between gap-3 border-t-2 border-line bg-sand p-3">
        <div>
          {saving > 0 && (
            <s className="k-mono block text-[11px] text-ink-soft">
              Normal: {formatRupiah(bundle.normalPrice)}
            </s>
          )}
          <span className="font-[family-name:var(--font-body)] text-[21px] font-extrabold text-pink-deep tabular-nums">
            {formatRupiah(bundle.price)}
          </span>{" "}
          {saving > 0 && (
            <span className={cn("k-tag k-tag-flat", accent ? "k-tag-red" : "k-tag-yellow")}>
              Hemat {formatRupiah(saving)}
            </span>
          )}
          <span
            className={cn(
              "mt-1 block text-[12px] font-bold",
              remaining <= 3 ? "text-hot" : "text-ink-soft",
            )}
          >
            {remaining <= 0
              ? inCart > 0
                ? "Semua sisanya udah di keranjang"
                : "Isinya lagi habis"
              : remaining <= 3
                ? `Tinggal ${remaining} paket lagi!`
                : `Bisa ${remaining} paket lagi`}
          </span>
        </div>

        <Button
          size="sm"
          variant={accent ? "primary" : "go"}
          disabled={!preorderOpen || remaining <= 0}
          onClick={(event) => onClaim(bundle, event.currentTarget.getBoundingClientRect())}
          aria-label={`Masukin ${bundle.name} ke keranjang`}
          className="gap-1.5"
        >
          Claim this combo
          {inCart > 0 && <span className="tabular-nums">· {inCart}</span>}
        </Button>
      </div>
    </article>
  );
}
