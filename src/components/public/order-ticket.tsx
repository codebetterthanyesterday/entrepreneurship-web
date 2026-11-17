import * as React from "react";
import { renderSVG } from "uqr";
import { cn } from "@/lib/utils";
import { CopyCodeButton } from "./copy-code-button";
import { OrderReceipt } from "./order-receipt";
import type { TrackedOrder } from "@/types/order-view";

export const PAYMENT_LABEL = {
  CASH: "Bayar pas ambil",
  QRIS: "QRIS",
} as const;

export interface OrderTicketProps {
  order: TrackedOrder;
  /**
   * The order number is the confirmation page's subject, so there it is the
   * page's `<h1>`. On the tracker the stage's title has that job, and the
   * number is a plain paragraph.
   */
  numberAs?: "h1" | "p";
  className?: string;
}

/**
 * The design's "Official Adventurer Pass": everything a customer shows or reads
 * out at the booth, on one ticket. The order number set large, whose it is and
 * when to come, what was ordered and what it costs, and how it is paid.
 *
 * Mobile-first: one column on a phone, with the pass panel under the details
 * behind a dashed tear line; from 640px the panel moves to the right, as the
 * design draws it.
 *
 * The lines and totals are `OrderReceipt`, not a second list drawn here, so
 * photobooth charges and the combined total show up on the ticket the same way
 * they do everywhere else.
 *
 * The QR holds the order number and nothing else. It is drawn from our own
 * string through `uqr`, never from user input, which is what makes handing the
 * SVG to `dangerouslySetInnerHTML` safe.
 */
export function OrderTicket({ order, numberAs = "p", className }: OrderTicketProps) {
  const cancelled = order.status === "CANCELLED";
  const paid = order.paymentStatus === "PAID";
  const Number = numberAs;
  const qr = renderSVG(order.orderNumber, { border: 1, ecc: "M" });

  return (
    <article className={cn("k-ticket", className)}>
      <div className="k-ticket-main">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="k-mono text-[10.5px] text-ink">
            <span aria-hidden="true" className="text-pink-deep">
              ●{" "}
            </span>
            Official adventurer pass
          </p>
          <p className="flex flex-wrap gap-1.5">
            {order.pickupSlot && (
              <span className="k-tag k-tag-flat !bg-sand">Slot: {order.pickupSlot}</span>
            )}
            <span
              className={cn(
                "k-tag k-tag-flat",
                cancelled ? "k-tag-red" : paid ? "k-tag-yellow" : "k-tag-soft",
              )}
            >
              Status: {cancelled ? "Dibatalkan" : paid ? "Lunas" : "Belum dibayar"}
            </span>
          </p>
        </div>

        <div className="k-codebox">
          <div className="min-w-0">
            <p aria-hidden="true" className="k-mono text-[10px] text-ink-soft">
              Order code (nomor pesanan)
            </p>
            <Number className="k-code tabular-nums">
              <span className="sr-only">Nomor pesanan </span>
              {order.orderNumber}
            </Number>
          </div>
          <div className="min-w-0 tablet:text-right">
            <p className="k-mono text-[10px] text-ink-soft">Reservasi atas nama</p>
            <p className="break-words text-[18px] font-extrabold leading-tight text-ink">
              {order.customerName}
            </p>
            {order.pickupSlot && (
              <p className="text-[13.5px] text-ink-soft">
                Ambil jam <span className="font-bold tabular-nums text-ink">{order.pickupSlot}</span>
              </p>
            )}
          </div>
        </div>

        <OrderReceipt
          lines={order.items.map((item, index) => ({
            key: `${item.name}-${index}`,
            name: item.name,
            quantity: item.quantity,
            subtotal: item.subtotal,
            detail: item.contents ?? null,
          }))}
          total={order.totalAmount}
          photobooth={order.photobooth}
          title="Rincian loot bag"
        />

        <div className="k-codebox !mb-0 items-center">
          <div>
            <p className="k-mono text-[10px] text-ink-soft">Metode pembayaran</p>
            <p className="text-[15px] font-extrabold text-sky-deep">
              {PAYMENT_LABEL[order.paymentMethod]}
            </p>
          </div>
          <div className="tablet:text-right">
            <p className="k-mono text-[10px] text-ink-soft">Status bayar</p>
            <p className={cn("text-[15px] font-extrabold", paid ? "text-ok" : "text-warn")}>
              {paid ? "Udah lunas" : "Belum dibayar"}
            </p>
          </div>
        </div>
      </div>

      <div className="k-ticket-pass">
        <p className="k-mono text-[13px] text-pink-deep">Order pass ticket</p>
        <p className="text-[13px] text-ink-soft">
          Tunjukin ke kasir pas ambil pesanan. <b className="text-ink">Bukan QR buat bayar.</b>
        </p>

        <div className="k-ticket-qr">
          <span
            role="img"
            aria-label={`Kode QR nomor pesanan ${order.orderNumber}, untuk ditunjukkan ke kasir, bukan untuk pembayaran`}
            className="block [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <span aria-hidden="true" className="k-mono mt-1.5 block text-[9.5px] text-ink">
            Pass ID: #{order.orderNumber}
          </span>
        </div>

        <p className="mb-3 text-[13px] leading-relaxed text-ink-soft">
          Tunjukin kode QR atau sebutin nomor pesanan ini ke kasir.
        </p>

        <CopyCodeButton code={order.orderNumber} />
      </div>
    </article>
  );
}
