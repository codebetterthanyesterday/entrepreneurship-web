"use client";

import * as React from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/components/ui/use-toast";
import { flyToCart } from "@/lib/fly-to-cart";
import { formatRupiah } from "@/lib/utils";
import { ActionBar, OrderReceipt, SummaryPanel, cartLines } from "./order-receipt";
import { JourneyEmpty, JourneyHero } from "./journey";
import { CartArt } from "./journey-art";
import { ProductVisual } from "./product-card";
import type { PublicProduct } from "@/types/admin";

export interface CartViewProps {
  products: PublicProduct[];
  preorderOpen: boolean;
}

export function CartView({ products, preorderOpen }: CartViewProps) {
  const cart = useCart(products);

  return (
    <>
      {/* ------------------------------------------------------- heading ---- */}
      <JourneyHero
        step="cart"
        eyebrow="Keranjang"
        title="Cek dulu sebelum lanjut"
        art={<CartArt count={cart.isReady ? cart.itemCount : 0} />}
      />

      <CartBody cart={cart} products={products} preorderOpen={preorderOpen} />
    </>
  );
}

/**
 * Split out so the three states — still reading storage, empty, and filled —
 * share one heading band. The heading is true in all three, and rebuilding it per
 * branch is how a page ends up with three slightly different headers.
 */
function CartBody({
  cart,
  products,
  preorderOpen,
}: {
  cart: ReturnType<typeof useCart>;
  /** The full rows, for each line's picture — the cart itself keeps only ids. */
  products: PublicProduct[];
  preorderOpen: boolean;
}) {
  // Before the browser's cart has been read there is nothing to show yet, and
  // rendering the empty state would flash "keranjang sepi" at someone whose cart
  // is full.
  if (!cart.isReady) {
    return (
      <section className="band-tight menu-counter">
        <div className="band-inner">
          <p className="text-sm text-ink-soft" aria-busy="true">
            Lagi ngambil keranjang kamu…
          </p>
        </div>
      </section>
    );
  }

  if (cart.entries.length === 0) {
    return (
      <section className="band menu-counter">
        <div className="band-inner">
          {/*
            Written for this page rather than taken from the shared "no data"
            component. An empty cart is not a missing record — it is a moment to
            point somebody at the menu, and it deserves the page's own voice.
          */}
          <JourneyEmpty
            eyebrow="Masih kosong"
            title="Belum ada apa-apa di keranjang kamu."
            body="Pilih jajanannya dulu, nanti jumlah dan totalnya muncul di sini."
          >
            <ButtonLink href="/" className="mt-7">
              Lihat menu
            </ButtonLink>
          </JourneyEmpty>
        </div>
      </section>
    );
  }

  const lines = cartLines(cart.entries);
  const productsById = new Map(products.map((product) => [product.id, product]));

  return (
    <>
      <section className="band-tight menu-counter">
        <div className="band-inner">
          {!preorderOpen && (
            <p
              role="status"
              className="mb-6 border-l-2 border-warn bg-warn-soft/70 py-3 pl-4 pr-3 text-[13.5px] leading-relaxed text-warn"
            >
              Preorder lagi ditutup, jadi pesanan baru belum bisa dikirim. Keranjang kamu aman kok.
            </p>
          )}

          <div className="flex items-start gap-8">
            <div className="min-w-0 flex-1">
              <h2 className="eyebrow text-pink-deep">
                {cart.itemCount} item &middot; {lines.length} jenis
              </h2>

              {/* The tray: each line a card on it, the picture large enough to
                  recognise at a glance, the controls under the name. */}
              <ul className="tray mt-3 flex flex-col gap-2.5 rounded-[26px] p-2.5 tablet:p-3">
                {cart.entries.map((entry) => (
                  <li
                    key={entry.productId}
                    className="flex items-center gap-3 rounded-[20px] bg-white p-2.5 shadow-[0_10px_24px_-18px_rgba(46,33,32,0.5)] tablet:gap-4 tablet:p-3"
                  >
                    <ProductVisual
                      product={
                        productsById.get(entry.productId) ?? {
                          ...entry.product,
                          imageUrl: null,
                          categoryName: null,
                        }
                      }
                      className="h-[76px] w-[76px] rounded-[16px] p-2 tablet:h-20 tablet:w-20"
                    />

                    <span className="flex min-w-0 flex-1 flex-col gap-2 tablet:flex-row tablet:items-center tablet:gap-4">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold leading-snug text-ink line-clamp-2">
                          {entry.product.name}
                        </span>
                        <span className="mt-0.5 flex items-baseline gap-2">
                          <span className="font-[family-name:var(--font-display)] text-[16px] font-semibold text-ink tabular-nums">
                            {formatRupiah(entry.subtotal)}
                          </span>
                          <span className="text-[11.5px] font-semibold text-ink-soft tabular-nums">
                            @{formatRupiah(entry.product.price)}
                          </span>
                        </span>
                      </span>

                      <span className="flex flex-none items-center gap-1">
                        <Stepper
                          value={entry.quantity}
                          min={1}
                          max={entry.product.stock}
                          label={`Jumlah ${entry.product.name}`}
                          onChange={(next) => cart.updateQuantity(entry.productId, next)}
                        />

                        {/* Borderless: removing a line is a quiet action, and giving
                          it the same outline as the stepper made two controls of
                          equal weight out of one control and one escape hatch. */}
                        <button
                          type="button"
                          aria-label={`Hapus ${entry.product.name}`}
                          onClick={() => cart.removeItem(entry.productId)}
                          className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-[12px] text-ink-soft transition-colors hover:bg-hot-soft hover:text-hot"
                        >
                          <svg
                            width="17"
                            height="17"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M3 4h10M6.5 4V2.8h3V4M4.2 4l.6 8.4c0 .5.4.8.9.8h4.6c.5 0 .9-.3.9-.8L11.8 4"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              <AlsoGood cart={cart} products={products} />

              {/* The bill, for the single column a phone has: a strip of
                  receipt paper. The panel carries it on a wide screen. */}
              <OrderReceipt
                lines={lines}
                total={cart.total}
                title="Struk sementara"
                className="receipt-paper mt-8 desktop:hidden"
              />
            </div>

            <SummaryPanel>
              <OrderReceipt lines={lines} total={cart.total} title="Struk sementara" />

              <div className="mt-5">
                {preorderOpen ? (
                  <ButtonLink href="/checkout" variant="primary" fullWidth>
                    Lanjut isi data
                  </ButtonLink>
                ) : (
                  <Button variant="primary" fullWidth disabled>
                    Preorder lagi ditutup
                  </Button>
                )}
              </div>
            </SummaryPanel>
          </div>
        </div>
      </section>

      <ActionBar itemCount={cart.itemCount} total={cart.total}>
        {preorderOpen ? (
          <ButtonLink href="/checkout" variant="primary" fullWidth>
            Lanjut isi data
          </ButtonLink>
        ) : (
          <Button variant="primary" fullWidth disabled>
            Preorder lagi ditutup
          </Button>
        )}
      </ActionBar>
    </>
  );
}

/**
 * "Sekalian?": the rest of the menu, one tap from the tray. A short row of what
 * is not in the cart yet and still in stock, the way a counter keeps the small
 * things by the till.
 */
function AlsoGood({
  cart,
  products,
}: {
  cart: ReturnType<typeof useCart>;
  products: PublicProduct[];
}) {
  const { toast } = useToast();
  const others = products
    .filter((product) => cart.quantityOf(product.id) === 0 && product.stock > 0)
    .slice(0, 6);

  if (others.length === 0) return null;

  return (
    <section aria-labelledby="sekalian" className="mt-7">
      <h2 id="sekalian" className="display-3 text-ink">
        Sekalian?
      </h2>
      <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 tablet:mx-0 tablet:px-0">
        {others.map((product) => (
          <li key={product.id} className="w-[132px] flex-none snap-start">
            <div className="relative">
              <ProductVisual product={product} className="aspect-square w-full rounded-[20px] p-4" />
              <button
                type="button"
                aria-label={`Tambah 1 ${product.name} ke keranjang`}
                onClick={(event) => {
                  cart.addItem(product.id, 1);
                  flyToCart(event.currentTarget.getBoundingClientRect());
                  toast(`${product.name} masuk keranjang!`);
                }}
                className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-pink-deep text-white shadow-[0_8px_18px_-8px_var(--color-pink-deep)] transition-transform active:scale-90"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-[13px] font-semibold leading-snug text-ink line-clamp-2">
              {product.name}
            </p>
            <p className="text-[12.5px] font-semibold text-ink-soft tabular-nums">
              {formatRupiah(product.price)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
