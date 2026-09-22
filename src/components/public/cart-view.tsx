"use client";

import * as React from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { useCart } from "@/hooks/use-cart";
import { formatRupiah } from "@/lib/utils";
import { ActionBar, OrderReceipt, SummaryPanel, cartLines } from "./order-receipt";
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
      <section className="band-tight band-dark">
        <div className="band-inner">
          <p className="eyebrow text-pink">Keranjang</p>
          <h1 className="display-2 mt-3 text-white">Cek dulu sebelum lanjut</h1>
        </div>
      </section>

      <CartBody cart={cart} preorderOpen={preorderOpen} />
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
  preorderOpen,
}: {
  cart: ReturnType<typeof useCart>;
  preorderOpen: boolean;
}) {
  // Before the browser's cart has been read there is nothing to show yet, and
  // rendering the empty state would flash "keranjang sepi" at someone whose cart
  // is full.
  if (!cart.isReady) {
    return (
      <section className="band-tight band-cream">
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
      <section className="band band-cream">
        <div className="band-inner">
          {/*
            Written for this page rather than taken from the shared "no data"
            component. An empty cart is not a missing record — it is a moment to
            point somebody at the menu, and it deserves the page's own voice
            instead of a large centred emoji.
          */}
          <div className="max-w-[40ch]">
            <p className="eyebrow text-pink-deep">Masih kosong</p>
            <p className="display-3 mt-3 text-ink">Belum ada apa-apa di keranjang kamu.</p>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
              Pilih jajanannya dulu, nanti jumlah dan totalnya muncul di sini.
            </p>

            <ButtonLink href="/menu" className="mt-7">
              Lihat menu
            </ButtonLink>
          </div>
        </div>
      </section>
    );
  }

  const lines = cartLines(cart.entries);

  return (
    <>
      <section className="band-tight band-cream">
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

              {/* Receipt lines you can still change: name and price on the top
                  line, the controls beneath on a phone and beside them from
                  tablet up, all on hairlines rather than in cards. */}
              <ul className="mt-3 flex flex-col">
                {cart.entries.map((entry) => (
                  <li
                    key={entry.productId}
                    className="flex flex-col gap-3 border-t border-line py-4 tablet:flex-row tablet:items-center tablet:gap-4 last:border-b"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-3">
                        <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold text-ink">
                          {entry.product.name}
                        </span>
                        <span className="flex-none text-[15px] font-semibold text-ink tabular-nums">
                          {formatRupiah(entry.subtotal)}
                        </span>
                      </span>
                      <span className="eyebrow mt-1 block text-ink-soft">
                        {formatRupiah(entry.product.price)} per porsi
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
                        <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
                  </li>
                ))}
              </ul>

              {/* The total, for the single column a phone has. The panel carries
                  it on a wide screen, where this one is hidden. */}
              <div className="mt-6 flex items-baseline justify-between desktop:hidden">
                <span className="eyebrow text-ink-soft">Total</span>
                <span className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink tabular-nums">
                  {formatRupiah(cart.total)}
                </span>
              </div>
            </div>

            <SummaryPanel>
              <OrderReceipt lines={lines} total={cart.total} title="Ringkasan" />

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
