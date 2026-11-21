import { describeHandover, formatServiceDate, isDelivered } from "@/lib/schedule";
import { formatRupiah } from "@/lib/utils";
import type { TrackedOrder } from "@/types/order-view";

/**
 * What goes on the saved picture of a customer's ticket ("Simpan tiket"): the
 * same facts as the ticket on screen, settled into words once, here, so the
 * drawing code only places them. Pure, so it is tested without a canvas.
 */

export interface TicketLine {
  name: string;
  quantity: number;
  subtotal: string;
  detail: string | null;
}

export interface TicketContent {
  brand: string;
  orderNumber: string;
  customerName: string;
  /** "Sab, 22 Nov 2026" and "Jam 10.00 - 11.00", as chips; either may be missing. */
  chips: string[];
  statusChip: string;
  /** "Diserahkan Sab, 22 Nov 2026 · 10.00 - 11.00 · Market Day"; null without a schedule. */
  handover: string | null;
  lines: TicketLine[];
  total: string;
  paymentMethod: string;
  paid: boolean;
  /** Who the QR is shown to: "kasir" at the booth, "tim kami" for a delivery. */
  shownTo: string;
  showLine: string;
  /**
   * Where the live status is ("bunnye.vercel.app/lacak"): a saved picture
   * keeps the status it was saved with, the tracker keeps up.
   */
  trackAt: string;
}

export function ticketContent(order: TrackedOrder, brand: string, host: string): TicketContent {
  const delivered = isDelivered(order);
  const paid = order.paymentStatus === "PAID";
  const cancelled = order.status === "CANCELLED";
  const chips = [
    order.serviceDate ? formatServiceDate(order.serviceDate) : null,
    order.pickupSlot ? `Jam ${order.pickupSlot}` : null,
  ].filter((chip): chip is string => chip !== null);

  return {
    brand,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    chips,
    statusChip: cancelled ? "Dibatalkan" : paid ? "Lunas" : "Belum dibayar",
    handover: order.pickupSlot ? `${order.serviceDate ? "Diserahkan" : "Ambil jam"} ${describeHandover(order)}` : null,
    lines: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      subtotal: formatRupiah(item.subtotal),
      detail: item.contents?.trim() || null,
    })),
    total: formatRupiah(order.totalAmount),
    paymentMethod: order.paymentMethod === "QRIS" ? "QRIS" : delivered ? "Tunai pas diantar" : "Bayar pas ambil",
    paid,
    shownTo: delivered ? "tim kami" : "kasir",
    showLine: delivered ? "Tunjukin ke tim kami pas pesanannya diantar." : "Tunjukin ke kasir pas ambil pesanan.",
    trackAt: `${host}/lacak`,
  };
}

/** "Tiket-PO-7KX4QM.png": the order number keeps two saved tickets apart. */
export function ticketFileName(orderNumber: string): string {
  return `Tiket-${orderNumber.replace(/[^A-Za-z0-9-]/g, "")}.png`;
}

/**
 * Breaks `text` into lines no wider than `maxWidth`, by words, and a word too
 * long for a line by characters. `measure` is the canvas's, passed in so this
 * stays testable.
 */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    // A single word wider than the line: cut it where it no longer fits.
    let rest = word;
    while (measure(rest) > maxWidth && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && measure(rest.slice(0, cut)) > maxWidth) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines;
}
