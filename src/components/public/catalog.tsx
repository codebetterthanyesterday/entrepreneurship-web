"use client";

import * as React from "react";
import Link from "next/link";
import { cn, formatRupiah } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useCart } from "@/hooks/use-cart";
import { flyToCart } from "@/lib/fly-to-cart";
import { isDrink } from "@/lib/flavor";
import { JourneyEmpty, JourneyRail } from "./journey";
import { FlavorArt } from "./flavor-art";
import { ProductCard } from "./product-card";
import { ProductDetailSheet } from "./product-detail-sheet";
import { OrderReceipt, SummaryPanel, cartLines } from "./order-receipt";
import type { PublicProduct } from "@/types/admin";

/** Products with no category, gathered at the end. */
const OTHER = "Lainnya";

export interface CatalogProps {
  products: PublicProduct[];
  categories: string[];
  preorderOpen: boolean;
}

/**
 * The menu, and the page the site opens on.
 *
 * Laid out like a counter rather than a list: a dark board with the day's
 * state on it, then every category as its own shelf of tiles, two to a row on
 * a phone. The category bar under the header jumps between shelves and lights
 * up whichever one is on screen; a short menu reads better whole than filtered.
 *
 * Ordering itself is unchanged: the sheet, the stock that counts down as the
 * cart fills, the panel on a wide screen and the bill along the bottom of a
 * phone.
 */
export function Catalog({ products, categories, preorderOpen }: CatalogProps) {
  const { toast } = useToast();
  const cart = useCart(products);
  const [selected, setSelected] = React.useState<PublicProduct | null>(null);

  const shelves = React.useMemo(() => shelvesOf(products, categories), [products, categories]);
  const active = useActiveShelf(shelves.map((shelf) => shelf.id));

  const add = (product: PublicProduct, quantity: number, origin?: DOMRect) => {
    cart.addItem(product.id, quantity);
    // Measured before anything closes, so the dot leaves from the button that
    // was pressed.
    flyToCart(origin);
    toast(`${product.name} masuk keranjang!`);
  };

  const handleSheetAdd = (productId: string, quantity: number, origin?: DOMRect) => {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) return;
    add(product, quantity, origin);
    setSelected(null);
  };

  return (
    <>
      <MenuBoard products={products} preorderOpen={preorderOpen} />

      {shelves.length > 1 && <ShelfBar shelves={shelves} active={active} />}

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

          <div className="flex items-start gap-8">
            <div className="min-w-0 flex-1">
              {shelves.length === 0 ? (
                <JourneyEmpty
                  eyebrow="Kosong"
                  title="Menunya lagi disiapin."
                  body="Belum ada menu yang dijual. Cek lagi sebentar, ya."
                />
              ) : (
                shelves.map((shelf) => (
                  <section
                    key={shelf.id}
                    id={shelf.id}
                    aria-labelledby={`${shelf.id}-title`}
                    className="shelf mb-10 last:mb-0"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <span className="h-9 w-9 flex-none">
                        <FlavorArt product={{ name: shelf.sample, categoryName: shelf.name }} />
                      </span>
                      <h2 id={`${shelf.id}-title`} className="display-3 text-ink">
                        {shelf.name}
                      </h2>
                      <span className="text-[12.5px] font-semibold text-ink-soft">
                        {shelf.products.length} menu
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-6 tablet:grid-cols-3 tablet:gap-x-5 desktop:grid-cols-4 desktop:gap-x-4">
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

            <SummaryPanel>
              <OrderReceipt
                lines={cartLines(cart.entries)}
                total={cart.total}
                title="Keranjang kamu"
                emptyNote="Belum ada apa-apa. Ketuk + di menu buat mulai."
              />

              <div className="mt-5">
                {cart.itemCount === 0 || !preorderOpen ? (
                  <Button variant="primary" fullWidth disabled>
                    {!preorderOpen ? "Preorder lagi ditutup" : "Keranjang masih kosong"}
                  </Button>
                ) : (
                  <ButtonLink href="/keranjang" variant="primary" fullWidth>
                    Lanjut ke keranjang
                  </ButtonLink>
                )}
              </div>
            </SummaryPanel>
          </div>
        </div>
      </section>

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

/**
 * The dark board the menu opens with: whether preorder is open, where to pick
 * up, the greeting, and the day's menu itself, drawn along the edge.
 *
 * Kept short on a phone: the first tiles have to show without a scroll.
 */
function MenuBoard({ products, preorderOpen }: { products: PublicProduct[]; preorderOpen: boolean }) {
  // Up to three on display, a drink first if there is one, so the board shows
  // what kind of counter this is.
  const display = [
    ...products.filter((product) => isDrink(product)).slice(0, 1),
    ...products.filter((product) => !isDrink(product)).slice(0, 2),
  ].slice(0, 3);

  return (
    <section className="band-dark band-glow relative overflow-hidden pb-5 pt-6 tablet:pb-8 tablet:pt-10">
      <div className="band-inner relative">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 py-1 pl-2.5 pr-3 text-[12px] font-semibold text-white">
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 flex-none rounded-full",
                  preorderOpen ? "board-live bg-ok-soft" : "bg-white/35",
                )}
              />
              {preorderOpen ? "Preorder lagi buka" : "Preorder lagi tutup"}
            </p>
            <h1 className="display-2 mt-3 text-white">
              Mau ngemil <em className="not-italic text-pink">apa</em> hari ini?
            </h1>
            <p className="mt-2 hidden text-[13.5px] text-white/70 tablet:block">Stoknya kepotong tiap ada yang pesan, jadi sisanya selalu yang terbaru.</p>
          </div>

          {display.length > 0 && (
            <div
              aria-hidden="true"
              className="relative h-[5.5rem] w-[6.5rem] flex-none tablet:h-40 tablet:w-64"
            >
              {display.map((product, index) => (
                <span
                  key={product.id}
                  className="board-item absolute bottom-0 aspect-square"
                  style={
                    {
                      "--i": index,
                      left: `${index * 30}%`,
                      width: index === 0 ? "62%" : "52%",
                      zIndex: index === 0 ? 2 : 1,
                    } as React.CSSProperties
                  }
                >
                  <FlavorArt product={product} live />
                </span>
              ))}
            </div>
          )}
        </div>

        <JourneyRail current="menu" className="mt-4 max-w-[28rem] tablet:mt-7" />
      </div>
    </section>
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

function ShelfBar({ shelves, active }: { shelves: Shelf[]; active: string | null }) {
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
        {shelves.map((shelf) => {
          const current = active === shelf.id;
          return (
            <li key={shelf.id} className="flex-none">
              <a
                href={`#${shelf.id}`}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "flex min-h-[44px] items-center gap-2 rounded-full pl-1.5 pr-4 text-[13.5px] font-semibold transition-colors",
                  current
                    ? "bg-ink text-white"
                    : "border-[1.5px] border-line bg-white text-ink-soft hover:border-pink hover:text-pink-deep",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("h-8 w-8 rounded-full p-0.5", current ? "bg-white/12" : "bg-cream")}
                >
                  <FlavorArt product={{ name: shelf.sample, categoryName: shelf.name }} />
                </span>
                {shelf.name}
                <span className={cn("tabular-nums", current ? "text-white/60" : "text-ink-soft/70")}>
                  {shelf.products.length}
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
 * The cart, docked along the bottom of a phone above the navigation: what is
 * in it and what it comes to, one tap from the bag. A wide screen has the
 * summary panel instead.
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
    <div className="desktop:hidden sticky bottom-[var(--nav-bar-height)] z-30 px-3 pb-[var(--action-bar-inset)]">
      <Link
        href="/keranjang"
        className="flex min-h-[60px] items-center gap-3 rounded-[22px] bg-ink-deep px-3 py-2.5 text-white shadow-[0_18px_34px_-16px_rgba(36,21,20,0.7)]"
      >
        <span
          key={itemCount}
          className="nav-count-pop flex h-10 w-10 flex-none items-center justify-center rounded-[14px] bg-pink-deep font-bold tabular-nums"
        >
          {itemCount}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-semibold text-white/65">
            {preorderOpen ? "item di keranjang" : "Preorder lagi ditutup"}
          </span>
          <span className="block font-[family-name:var(--font-display)] text-[18px] font-semibold tabular-nums">
            {formatRupiah(total)}
          </span>
        </span>
        <span className="flex items-center gap-1 rounded-[14px] bg-white px-3.5 py-2.5 text-[14px] font-bold text-ink-deep">
          Keranjang
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M9 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </Link>
    </div>
  );
}
