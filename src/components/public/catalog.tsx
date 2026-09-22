"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useCart } from "@/hooks/use-cart";
import { Reveal } from "@/components/site/reveal";
import { flyToCart } from "@/lib/fly-to-cart";
import { JourneyEmpty, JourneyHero } from "./journey";
import { MenuArt } from "./journey-art";
import { ProductCard } from "./product-card";
import { ProductDetailSheet } from "./product-detail-sheet";
import { ActionBar, OrderReceipt, SummaryPanel, cartLines } from "./order-receipt";
import type { PublicProduct } from "@/types/admin";

const ALL_FILTER = "Semua";

export interface CatalogProps {
  products: PublicProduct[];
  categories: string[];
  preorderOpen: boolean;
}

/**
 * The catalogue, in the profile page's visual language.
 *
 * It owns its own bands rather than sitting inside `PageShell`, because the
 * heading needs the dark field the profile opens with — arriving here from that
 * page's "Lihat menu" should feel like the same site, not a jump to a different
 * one. The band structure is the only reason `main` gave up its measure.
 *
 * What did not change is how ordering works: the filter, the sheet, the cart
 * panel and the sticky bill all behave exactly as before.
 */
export function Catalog({ products, categories, preorderOpen }: CatalogProps) {
  const { toast } = useToast();
  const cart = useCart(products);

  const [filter, setFilter] = React.useState<string>(ALL_FILTER);
  const [selected, setSelected] = React.useState<PublicProduct | null>(null);

  const filters = [ALL_FILTER, ...categories];
  const hasFilterBar = filters.length > 1;

  const visible =
    filter === ALL_FILTER
      ? products
      : products.filter((product) => product.categoryName === filter);

  const handleAdd = (productId: string, quantity: number, origin?: DOMRect) => {
    const product = products.find((candidate) => candidate.id === productId);

    cart.addItem(productId, quantity);
    // Measured by the sheet before it closes, so the dot leaves from the button
    // that was pressed rather than from where the sheet used to be.
    flyToCart(origin);
    setSelected(null);
    toast(`${product?.name ?? "Menunya"} masuk keranjang!`);
  };

  return (
    <>
      {/* ------------------------------------------------------- heading ---- */}
      <JourneyHero
        step="menu"
        eyebrow="Menu · Market Day"
        title="Mau ngemil apa hari ini?"
        lede="Stok terbatas dan kepotong tiap ada yang pesan, jadi angka sisanya di bawah itu yang paling baru."
        art={<MenuArt />}
      />

      {/* -------------------------------------------------------- filter ---- */}
      {hasFilterBar && (
        <div
          className={cn(
            // Sticks directly below whatever chrome is above it: on a phone that
            // is the 64px header alone, because the navigation is at the bottom
            // there; from 640px up the navigation row joins it. `--page-top` is
            // the one place that sum is written down.
            "sticky top-[var(--page-top)] z-30",
            "bg-cream/92 backdrop-blur-md border-b border-line",
          )}
        >
          <div
            className="band-inner flex gap-2 overflow-x-auto py-3"
            role="group"
            aria-label="Filter kategori"
          >
            {filters.map((name) => {
              const active = filter === name;

              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(name)}
                  className={cn(
                    // 44px is the project's touch-target floor.
                    "flex-none min-h-[44px] px-4 rounded-full text-[13.5px] font-semibold transition-colors",
                    active
                      ? "bg-ink text-white"
                      : "bg-white text-ink-soft border-[1.5px] border-line hover:border-pink hover:text-pink-deep",
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- list ---- */}
      <section
        className="band-tight band-cream"
        // What the sticky cart panel has to clear. Declared here because only
        // this component knows whether the category bar was rendered at all.
        style={
          {
            "--filter-bar": hasFilterBar ? "var(--filter-bar-height)" : "0px",
          } as React.CSSProperties
        }
      >
        <div className="band-inner">
          {!preorderOpen && (
            <p
              role="status"
              className="mb-6 border-l-2 border-warn bg-warn-soft/70 py-3 pl-4 pr-3 text-[13.5px] leading-relaxed text-warn"
            >
              Preorder lagi ditutup. Kamu masih bisa lihat menu, tapi pesanan baru belum bisa
              dikirim.
            </p>
          )}

          <div className="flex items-start gap-8">
            <div className="flex-1 min-w-0">
              {visible.length === 0 ? (
                <JourneyEmpty
                  eyebrow="Kosong"
                  title="Belum ada menu di kategori ini."
                  body="Coba kategori lain, atau lihat semuanya sekaligus."
                >
                  <button
                    type="button"
                    onClick={() => setFilter(ALL_FILTER)}
                    className="mt-5 text-[14px] font-semibold text-pink-deep underline underline-offset-4 hover:text-ink"
                  >
                    Lihat semua menu
                  </button>
                </JourneyEmpty>
              ) : (
                <Reveal>
                  {/* One reveal for the whole list, not one per row: the rows are
                      re-keyed every time the filter changes, and staggering them
                      again on each tap reads as a glitch rather than as polish. */}
                  <div className="flex flex-col [&>*:last-child]:border-b [&>*:last-child]:border-line">
                    {visible.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        remaining={cart.remainingStock(product)}
                        onSelect={setSelected}
                      />
                    ))}
                  </div>
                </Reveal>
              )}
            </div>

            <SummaryPanel>
              <OrderReceipt
                lines={cartLines(cart.entries)}
                total={cart.total}
                title="Keranjang kamu"
                emptyNote="Belum ada apa-apa. Ketuk menu di sebelah buat mulai."
              />

              <div className="mt-5">
                {cart.itemCount === 0 || !preorderOpen ? (
                  <Button variant="primary" fullWidth disabled>
                    {!preorderOpen ? "Preorder lagi ditutup" : "Keranjang masih kosong"}
                  </Button>
                ) : (
                  <ButtonLink href="/keranjang" variant="primary" fullWidth>
                    Lanjut isi data
                  </ButtonLink>
                )}
              </div>
            </SummaryPanel>
          </div>
        </div>
      </section>

      {/*
        Outside the band on purpose. `position: sticky` is bounded by its parent's
        box, so inside the section it would come unstuck at the band's bottom
        padding — a few dozen pixels before the list actually ends. Out here its
        parent is the page, and the bill stays put until the footer.
      */}
      {/* Only once there is something in it. An empty bill with a disabled
          button took ~110px of a phone screen on the one page whose job is to
          show the menu — at 320px it left no item above the fold. */}
      {cart.itemCount > 0 && (
        <ActionBar itemCount={cart.itemCount} total={cart.total}>
          {cart.itemCount === 0 || !preorderOpen ? (
            <Button variant="primary" fullWidth disabled>
              {!preorderOpen ? "Preorder lagi ditutup" : "Keranjang masih kosong"}
            </Button>
          ) : (
            <ButtonLink href="/keranjang" variant="primary" fullWidth>
              Lanjut isi data
            </ButtonLink>
          )}
        </ActionBar>
      )}

      {selected && (
        <ProductDetailSheet
          // Remounting per product resets the quantity stepper to 1.
          key={selected.id}
          product={selected}
          remaining={cart.remainingStock(selected)}
          onClose={() => setSelected(null)}
          onAdd={handleAdd}
        />
      )}
    </>
  );
}
