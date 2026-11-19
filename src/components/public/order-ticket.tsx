import * as React from "react";
import { renderSVG } from "uqr";
import { describeHandover, formatServiceDate, isDelivered } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { CopyCodeButton } from "./copy-code-button";
import { ChatLink } from "./whatsapp-chat";
import { chatOrderOf } from "@/lib/whatsapp";
import { OrderReceipt } from "./order-receipt";
import type { TrackedOrder } from "@/types/order-view";

/** How the order is paid, in the words of how it is handed over. */
export function paymentLabel(method: "CASH" | "QRIS", delivered: boolean): string {
  if (method === "QRIS") return "QRIS";
  return delivered ? "Tunai pas diantar" : "Bayar pas ambil";
}

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
  // A campus or Lainnya order is brought by the team, so there is no cashier
  // to show the pass to.
  const delivered = isDelivered(order);
  const shownTo = delivered ? "tim kami" : "kasir";
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
            {order.serviceDate && (
              <span className="k-tag k-tag-flat !bg-sand">{formatServiceDate(order.serviceDate)}</span>
            )}
            {order.pickupSlot && (
              <span className="k-tag k-tag-flat !bg-sand">Jam: {order.pickupSlot}</span>
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
                {order.serviceDate ? "Diserahkan " : "Ambil jam "}
                <span className="font-bold text-ink">{describeHandover(order)}</span>
              </p>
            )}
          </div>
        </div>

        {order.awaitingLocationCheck && (
          <div role="status" className="mt-3 rounded-[10px] bg-warn-soft px-3 py-2.5 text-[13px] leading-relaxed text-warn">
            <p>
              <b>Lokasinya lagi kami cek.</b> Kami kabari lewat WhatsApp kalau bisa diantar ke sana.
              Kalau di luar jangkauan, pesanannya kami batalkan dan stoknya kembali.
            </p>
            <ChatLink
              intent={{ kind: "location", order: chatOrderOf(order) }}
              look="outline"
              className="mt-2.5 w-full bg-white"
            >
              Kirim patokan lokasi
            </ChatLink>
          </div>
        )}

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
              {paymentLabel(order.paymentMethod, delivered)}
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
          {delivered ? "Tunjukin ke tim kami pas pesanannya diantar." : "Tunjukin ke kasir pas ambil pesanan."}{" "}
          <b className="text-ink">Bukan QR buat bayar.</b>
        </p>

        <div className="k-ticket-qr">
          <span
            role="img"
            aria-label={`Kode QR nomor pesanan ${order.orderNumber}, untuk ditunjukkan ke ${shownTo}, bukan untuk pembayaran`}
            className="block [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <span aria-hidden="true" className="k-mono mt-1.5 block text-[9.5px] text-ink">
            Pass ID: #{order.orderNumber}
          </span>
        </div>

        <p className="mb-3 text-[13px] leading-relaxed text-ink-soft">
          Tunjukin kode QR atau sebutin nomor pesanan ini ke {shownTo}.
        </p>

        <CopyCodeButton code={order.orderNumber} />
      </div>
    </article>
  );
}
