"use client";

import * as React from "react";
import Link from "next/link";
import { cn, formatRupiah } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { bundleKey, useCart } from "@/hooks/use-cart";
import type { PublicBundle } from "@/lib/bundle";
import { flyToCart } from "@/lib/fly-to-cart";
import { isDrink } from "@/lib/flavor";
import { BRAND_NAME } from "@/lib/brand";
import { JourneyEmpty } from "./journey";
import { ProductCard, ProductVisual } from "./product-card";
import { ComboCard } from "./combo-card";
import { ProductDetailSheet } from "./product-detail-sheet";
import type { PublicProduct } from "@/types/admin";

/** Products with no category, gathered at the end. */
const OTHER = "Lainnya";

export interface CatalogProps {
  products: PublicProduct[];
  /** Pakets on offer; their section is left out when there are none. */
  bundles?: PublicBundle[];
  categories: string[];
  preorderOpen: boolean;
}

/** The combo section's anchor, for the category bar and the hero. */
const COMBO_ID = "paket-hemat";
const NO_BUNDLES: PublicBundle[] = [];

/**
 * The menu, and the page the site opens on.
 *
 * Laid out as the design's first world: the sky-blue welcome with the day's
 * state on it, then every category as its own "level" of cards, two to a row
 * on a phone and three on a desktop. The category bar under the header jumps
 * between levels and lights up whichever one is on screen; a short menu reads
 * better whole than filtered.
 *
 * Ordering itself is unchanged: the sheet, the stock that counts down as the
 * cart fills, and the bill docked along the bottom once there is something in
 * the cart. The design has no cart panel beside the menu, so the dock is the
 * one summary at every width.
 */
export function Catalog({ products, bundles = NO_BUNDLES, categories, preorderOpen }: CatalogProps) {
  const { toast } = useToast();
  const cart = useCart(products, bundles);
  const [selected, setSelected] = React.useState<PublicProduct | null>(null);

  const shelves = React.useMemo(() => shelvesOf(products, categories), [products, categories]);
  const active = useActiveShelf([
    ...shelves.map((shelf) => shelf.id),
    ...(bundles.length > 0 ? [COMBO_ID] : []),
  ]);

  const add = (product: PublicProduct, quantity: number, origin?: DOMRect) => {
    cart.addItem(product.id, quantity);
    // Measured before anything closes, so the dot leaves from the button that
    // was pressed.
    flyToCart(origin);
    toast(`${product.name} masuk keranjang!`);
  };

  const claim = (bundle: PublicBundle, origin?: DOMRect) => {
    cart.addItem(bundleKey(bundle.id), 1);
    flyToCart(origin);
    toast(`${bundle.name} masuk keranjang!`);
  };

  const handleSheetAdd = (productId: string, quantity: number, origin?: DOMRect) => {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) return;
    add(product, quantity, origin);
    setSelected(null);
  };

  return (
    <>
      <MenuBoard
        products={products}
        preorderOpen={preorderOpen}
        firstShelf={shelves[0]?.id ?? null}
      />

      {shelves.length + (bundles.length > 0 ? 1 : 0) > 1 && (
        <ShelfBar shelves={shelves} active={active} comboCount={bundles.length} />
      )}

      <section
        className="menu-counter pb-10 pt-5 tablet:pt-8"
        // What the sticky cart panel has to clear. Declared here because only
        // this component knows whether the category bar was rendered at all.
        style={
          {
            "--filter-bar": shelves.length > 1 ? "var(--filter-bar-height)" : "0px",
          } as React.CSSProperties
        }
      >
        <div className="band-inner">
          {!preorderOpen && (
            <p
              role="status"
              className="mb-6 rounded-[16px] border-l-4 border-warn bg-warn-soft py-3 pl-4 pr-3 text-[13.5px] leading-relaxed text-warn"
            >
              Preorder lagi ditutup. Kamu masih bisa lihat-lihat menu, tapi pesanan baru belum bisa
              dikirim.
            </p>
          )}

          {shelves.length === 0 ? (
            <JourneyEmpty
              eyebrow="Kosong"
              title="Menunya lagi disiapin."
              body="Belum ada menu yang dijual. Cek lagi sebentar, ya."
            />
          ) : (
            shelves.map((shelf, index) => (
              <section
                key={shelf.id}
                id={shelf.id}
                aria-labelledby={`${shelf.id}-title`}
                className="shelf mb-12 last:mb-0"
              >
                <div className="mb-5">
                  <span className="k-tag k-tag-soft">
                    Stage quest {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 id={`${shelf.id}-title`} className="display-2 text-[var(--k-navy)]">
                      Level {String(index + 1).padStart(2, "0")} — {shelf.name}
                    </h2>
                    <span className="k-mono text-[11px] text-ink-soft">
                      {shelf.products.length} menu
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-5 tablet:gap-x-5 tablet:gap-y-6 desktop:grid-cols-3 desktop:gap-x-6">
                  {shelf.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      remaining={cart.remainingStock(product)}
                      inCart={cart.quantityOf(product.id)}
                      onSelect={setSelected}
                      onQuickAdd={(chosen, origin) => add(chosen, 1, origin)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </section>

      {bundles.length > 0 && (
        <section
          id={COMBO_ID}
          aria-labelledby={`${COMBO_ID}-title`}
          className="shelf band-tight bg-sand"
        >
          <div className="band-inner">
            <div className="mx-auto max-w-[36em] text-center">
              <span className="k-tag k-tag-yellow">✪ Level up your snack!</span>
              <h2 id={`${COMBO_ID}-title`} className="display-2 mt-3 text-[var(--k-navy)]">
                Special power-up combos
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                Paket hemat buat ngemil lebih puas dan lebih ramah di kantong koinmu.
              </p>
            </div>

            <div className="mt-7 grid gap-6 tablet:grid-cols-2">
              {bundles.map((bundle, index) => (
                <ComboCard
                  key={bundle.id}
                  bundle={bundle}
                  index={index}
                  remaining={cart.remainingBundles(bundle.id)}
                  inCart={cart.quantityOf(bundleKey(bundle.id))}
                  preorderOpen={preorderOpen}
                  onClaim={claim}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/*
        Outside the band on purpose: `position: sticky` is bounded by its
        parent's box, so inside the section it would come unstuck before the
        list ends. Only once there is something in the cart: an empty bill on
        the one page whose job is to show the menu is a row of menu lost.
      */}
      {cart.itemCount > 0 && (
        <CartDock itemCount={cart.itemCount} total={cart.total} preorderOpen={preorderOpen} />
      )}

      {selected && (
        <ProductDetailSheet
          // Remounting per product resets the quantity stepper to 1.
          key={selected.id}
          product={selected}
          remaining={cart.remainingStock(selected)}
          onClose={() => setSelected(null)}
          onAdd={handleSheetAdd}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ board

/** "Rp10K" for a round thousand, the full figure otherwise. */
function shortPrice(price: number): string {
  return price % 1000 === 0 ? `Rp${price / 1000}K` : formatRupiah(price);
}

/**
 * What the menu opens with: the design's welcome on a sky-blue field, whether
 * preorder is open, and up to three of the day's items as tilted snapshots.
 * Under it, the strip of ground and the "World 1-1" bar.
 *
 * Mobile-first: the words come first and the snapshots stack under them, so
 * the button that jumps to the menu is on the first screen of a phone. From
 * the desktop breakpoint the two sit side by side, as the design draws them.
 */
function MenuBoard({
  products,
  preorderOpen,
  firstShelf,
}: {
  products: PublicProduct[];
  preorderOpen: boolean;
  /** Where "start" scrolls to; absent when there is nothing on the menu. */
  firstShelf: string | null;
}) {
  // Up to three on display, a drink first if there is one, so the board shows
  // what kind of counter this is.
  const display = [
    ...products.filter((product) => isDrink(product)).slice(0, 1),
    ...products.filter((product) => !isDrink(product)).slice(0, 2),
  ].slice(0, 3);

  return (
    <>
      <section className="k-hero">
        <div aria-hidden="true" className="k-cloud" style={{ top: 22, right: "6%" }} />

        <div className="band-inner k-hero-grid relative">
          <div>
            <p className="k-tag">
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 flex-none rounded-full",
                  preorderOpen ? "board-live bg-ok" : "bg-ink-soft/40",
                )}
              />
              {preorderOpen ? "Preorder lagi buka" : "Preorder lagi tutup"}
            </p>

            <h1 className="k-hero-title">
              Welcome to the <em>Snack Kingdom!</em>
            </h1>

            <p className="max-w-[34em] text-[15px] leading-relaxed text-ink">
              Petualangan ngemil dimulai di sini! Temukan camilan favoritmu dan pesan sebelum
              stoknya kehabisan. Stok kepotong tiap ada yang pesan, jadi sisanya selalu yang
              terbaru.
            </p>

            {firstShelf && (
              <a href={`#${firstShelf}`} className={cn(buttonClasses({}), "mt-5 gap-2")}>
                Start your snack adventure
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M5 12h14M13 6l6 6-6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            )}

            <p className="k-mono mt-4 flex flex-wrap items-center gap-2 text-[10px] text-ink">
              <span className="k-tag k-tag-yellow k-tag-flat">Stage 01</span>
              Select food &gt; Add to bag &gt; Checkout
            </p>
          </div>

          {display.length > 0 && (
            <div aria-hidden="true" className="k-polas">
              {display.map((product) => (
                <div key={product.id} className="k-pola">
                  <ProductVisual product={product} className="aspect-[16/10] w-full" />
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[13px] font-extrabold text-ink">
                    <span className="truncate">{product.name}</span>
                    <b className="k-mono flex-none text-[12px] text-pink-deep">
                      {shortPrice(product.price)}
                    </b>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div aria-hidden="true" className="k-ground k-ground-thin" />

      <div className="k-worldbar">
        <div className="band-inner flex items-center justify-between gap-3">
          <p>
            <b className="k-mono block text-[13px]">World 1-1 : {BRAND_NAME} Bazaar</b>
            {/* White, not the design's yellow: yellow on the dirt band is 4.3:1. */}
            <span className="k-mono text-[9.5px] text-white">
              {products.length} menu di etalase
            </span>
          </p>
          <span className="k-tag k-tag-yellow">
            {preorderOpen ? "Preorder: open" : "Preorder: closed"}
          </span>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ shelves

interface Shelf {
  id: string;
  name: string;
  /** A product name to draw the shelf's little icon from. */
  sample: string;
  products: PublicProduct[];
}

/** The categories in the admin's order, each with its products; empty ones left out. */
function shelvesOf(products: PublicProduct[], categories: string[]): Shelf[] {
  const names = [...categories];
  if (products.some((product) => !product.categoryName)) names.push(OTHER);

  return names
    .map((name, index) => {
      const inShelf = products.filter((product) => (product.categoryName ?? OTHER) === name);
      return {
        id: `rak-${index + 1}`,
        name,
        sample: inShelf[0]?.name ?? name,
        products: inShelf,
      };
    })
    .filter((shelf) => shelf.products.length > 0);
}

/** Which shelf is on screen, for the category bar. */
function useActiveShelf(ids: string[]): string | null {
  const [active, setActive] = React.useState<string | null>(ids[0] ?? null);
  const key = ids.join(",");

  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || key === "") return;
    const shelves = key
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    const observer = new IntersectionObserver(
      (records) => {
        const visible = records.filter((record) => record.isIntersecting);
        if (visible.length > 0) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActive(visible[0]!.target.id);
        }
      },
      // The band just under the sticky header and category bar.
      { rootMargin: "-140px 0px -55% 0px" },
    );
    shelves.forEach((shelf) => observer.observe(shelf));
    return () => observer.disconnect();
  }, [key]);

  return active;
}

function ShelfBar({
  shelves,
  active,
  comboCount,
}: {
  shelves: Shelf[];
  active: string | null;
  /** Pakets on offer; their chip goes last. */
  comboCount: number;
}) {
  const chips = [
    ...shelves.map((shelf) => ({ id: shelf.id, name: shelf.name, count: shelf.products.length })),
    ...(comboCount > 0 ? [{ id: COMBO_ID, name: "✪ Paket hemat", count: comboCount }] : []),
  ];

  return (
    <nav
      aria-label="Kategori menu"
      className={cn(
        // Sticks directly below whatever chrome is above it: on a phone that is
        // the header alone, from 640px up the navigation row joins it.
        "sticky top-[var(--page-top)] z-30",
        "border-b border-line bg-cream/92 backdrop-blur-md",
      )}
    >
      <ul className="band-inner flex gap-2 overflow-x-auto py-2.5">
        {chips.map((shelf) => {
          const current = active === shelf.id;
          return (
            <li key={shelf.id} className="flex-none">
              <a
                href={`#${shelf.id}`}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "k-mono flex min-h-[44px] items-center gap-2 px-3.5 text-[11px] transition-colors",
                  current
                    ? "k-hard-sm bg-pink-deep text-white"
                    : "bg-sand text-ink-soft hover:text-pink-deep",
                )}
              >
                [ {shelf.name} ]
                <span className={cn("tabular-nums", current ? "text-white/75" : "text-ink-soft")}>
                  {shelf.count}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ------------------------------------------------------------------ dock

/**
 * The cart, docked along the bottom edge — above the tab bar on a phone, a
 * floating slip from 640px up: what is in it and what it comes to, one tap
 * from the bag.
 */
function CartDock({
  itemCount,
  total,
  preorderOpen,
}: {
  itemCount: number;
  total: number;
  preorderOpen: boolean;
}) {
  return (
    <div className="sticky bottom-[var(--nav-bar-height)] z-30 tablet:px-4">
      <Link href="/keranjang" className="k-dock">
        <span className="min-w-0">
          <span className="k-mono block text-[10px] text-warn">
            <span key={itemCount} className="nav-count-pop inline-block tabular-nums">
              {itemCount}
            </span>{" "}
            {preorderOpen ? "item di bag" : "item · preorder ditutup"}
          </span>
          <span className="block font-[family-name:var(--font-display)] text-[20px] font-black leading-tight text-pink-deep tabular-nums">
            {formatRupiah(total)}
          </span>
        </span>
        <span className={cn(buttonClasses({ size: "sm" }), "flex-none gap-1.5")}>
          Lihat bag
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M5 12h14M13 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </Link>
    </div>
  );
}
