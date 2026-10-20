"use client";

import * as React from "react";
import { cn, formatRupiah } from "@/lib/utils";

/**
 * The receipt.
 *
 * Every customer screen after the menu is a view of the same bill — the cart, the
 * checkout summary, the confirmation, the tracked order — so there is one surface
 * for it rather than four sets of nearly-identical markup. That is also why they
 * all read the same way: hairlines instead of boxes, tabular figures so a column
 * of prices lines up, and a total set in the display face because it is the one
 * number anybody is actually looking for.
 *
 * Deliberately background-free. The wrapper supplies the surface, so the same
 * receipt works on white inside a panel and on cream inside a band.
 */
export interface ReceiptLine {
  key: string;
  name: string;
  quantity: number;
  subtotal: number;
}

/** A line another service added to the note, already paid there. */
export interface ExtraLine {
  key: string;
  description: string;
  amount: number;
}

export interface OrderReceiptProps {
  lines: readonly ReceiptLine[];
  total: number;
  /**
   * Photobooth charges (BPB-098), paid at the booth. Shown in their own
   * section after the food, which then gets its own subtotal; the bottom line
   * becomes the combined total. Food and photobooth never mix in one list.
   */
  photobooth?: readonly ExtraLine[];
  /** Small label above the lines. Omitted where the heading already says it. */
  title?: string;
  /** Shown in place of the lines when there are none. */
  emptyNote?: string;
  className?: string;
}

export function OrderReceipt({
  lines,
  total,
  photobooth = [],
  title,
  emptyNote,
  className,
}: OrderReceiptProps) {
  const extra = photobooth.reduce((sum, line) => sum + line.amount, 0);
  const withPhotobooth = photobooth.length > 0;

  return (
    <div className={className}>
      {title && <h2 className="eyebrow text-pink-deep">{title}</h2>}

      {lines.length === 0 ? (
        <p className={cn("text-[13.5px] leading-relaxed text-ink-soft", title && "mt-3")}>
          {emptyNote ?? "Belum ada apa-apa di sini."}
        </p>
      ) : (
        <ul className={cn("flex flex-col", title && "mt-3")}>
          {lines.map((line) => (
            <li
              key={line.key}
              className="flex justify-between gap-3 border-t border-line py-2.5 text-[13.5px] text-ink-soft"
            >
              <span className="min-w-0">
                {/* The count stays out of the truncation, so a long name never
                    hides how many of it were ordered. */}
                <span className="font-semibold text-ink tabular-nums">{line.quantity}&times;</span>{" "}
                <span className="truncate">{line.name}</span>
              </span>
              <span className="flex-none tabular-nums">{formatRupiah(line.subtotal)}</span>
            </li>
          ))}
        </ul>
      )}

      {withPhotobooth && (
        <>
          <div className="flex justify-between gap-3 border-t border-line py-2.5 text-[13.5px] text-ink">
            <span>Subtotal makanan</span>
            <span className="tabular-nums">{formatRupiah(total)}</span>
          </div>

          <section aria-labelledby="receipt-photobooth" className="mt-4">
            <h3 id="receipt-photobooth" className="eyebrow text-pink-deep">
              Photobooth
            </h3>
            <ul className="mt-2 flex flex-col">
              {photobooth.map((line) => (
                <li
                  key={line.key}
                  className="flex justify-between gap-3 border-t border-line py-2.5 text-[13.5px] text-ink-soft"
                >
                  <span className="min-w-0">{line.description}</span>
                  <span className="flex-none tabular-nums">{formatRupiah(line.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[12px] text-ink-soft">Sudah dibayar di booth photobooth.</p>
          </section>
        </>
      )}

      <div className="mt-4 flex items-baseline justify-between border-t border-ink/15 pt-4">
        <span className="eyebrow text-ink-soft">{withPhotobooth ? "Total gabungan" : "Total"}</span>
        <span className="font-[family-name:var(--font-display)] text-2xl font-semibold text-ink tabular-nums">
          {formatRupiah(total + extra)}
        </span>
      </div>
    </div>
  );
}

/**
 * The raised surface the receipt sits on beside the content on a wide screen.
 *
 * A shadow rather than an outline: on a cream field a soft lift separates the
 * panel without drawing one more rectangle on a page that already has enough of
 * them. `--filter-bar` is only set by the catalogue; everywhere else it resolves
 * to its 0px fallback.
 */
export function SummaryPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "hidden desktop:block sticky top-[calc(var(--page-top)+var(--filter-bar,0px)+1.5rem)]",
        "self-start w-[310px] flex-none",
        className,
      )}
    >
      <div className="rounded-[22px] bg-white p-5 shadow-[0_18px_40px_-24px_color-mix(in_srgb,var(--color-ink)_28%,transparent)]">
        {children}
      </div>
    </aside>
  );
}

/**
 * The bill along the bottom of a phone, where there is no room for a panel.
 *
 * Spans the page rather than a container, so it needs no negative margins to
 * reach the screen edge — and it must be a child of the page rather than of a
 * band, because `position: sticky` is bounded by its parent's box and would
 * otherwise come unstuck at the band's bottom padding.
 */
export function ActionBar({
  itemCount,
  total,
  children,
  note,
}: {
  itemCount: number;
  total: number;
  /** The call to action: a link on the menu and cart, a submit button at checkout. */
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div
      className={cn(
        "desktop:hidden sticky bottom-[var(--nav-bar-height)] z-30",
        "border-t border-line bg-white/95 backdrop-blur-md",
      )}
    >
      <div className="band-inner pt-3 pb-[var(--action-bar-inset)]">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="eyebrow text-ink-soft">
            {itemCount === 0 ? "Belum ada item" : `${itemCount} item`}
          </span>
          <b className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink tabular-nums">
            {formatRupiah(total)}
          </b>
        </div>

        {children}

        {note && <p className="mt-2 text-[11.5px] leading-snug text-ink-soft">{note}</p>}
      </div>
    </div>
  );
}

/** Turns cart entries into receipt lines. */
export function cartLines(
  entries: readonly { productId: string; quantity: number; subtotal: number; product: { name: string } }[],
): ReceiptLine[] {
  return entries.map((entry) => ({
    key: entry.productId,
    name: entry.product.name,
    quantity: entry.quantity,
    subtotal: entry.subtotal,
  }));
}
