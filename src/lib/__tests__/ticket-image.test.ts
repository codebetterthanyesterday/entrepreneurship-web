import { describe, expect, it } from "vitest";
import { ticketContent, ticketFileName, wrapText } from "@/lib/ticket-image";
import type { TrackedOrder } from "@/types/order-view";

const ORDER: TrackedOrder = {
  orderNumber: "PO-7KX4QM",
  customerName: "Amanda Larasati",
  pickupSlot: "10.00 - 11.00",
  serviceDate: "2026-11-22",
  handoverLocation: "MARKET_DAY",
  handoverDetail: null,
  awaitingLocationCheck: false,
  paymentMethod: "QRIS",
  paymentStatus: "UNPAID",
  hasPaymentProof: false,
  status: "CONFIRMED",
  notes: null,
  totalAmount: 43_000,
  needsPrep: true,
  items: [
    { name: "Kopi Susu", quantity: 2, priceAtOrder: 18_000, subtotal: 36_000 },
    { name: "Paket Hemat", quantity: 1, priceAtOrder: 7_000, subtotal: 7_000, contents: " 1× Roti " },
  ],
};

describe("ticketContent", () => {
  it("says what the ticket on screen says: the day, the hour, the place and the status", () => {
    const t = ticketContent(ORDER, "Bunnyè", "bunnye.vercel.app");

    expect(t.orderNumber).toBe("PO-7KX4QM");
    expect(t.chips).toHaveLength(2);
    expect(t.chips[1]).toBe("Jam 10.00 - 11.00");
    expect(t.handover).toMatch(/^Diserahkan .*10\.00 - 11\.00 · Market Day$/);
    expect(t.statusChip).toBe("Belum dibayar");
    expect(t.paymentMethod).toBe("QRIS");
    expect(t.total).toMatch(/Rp\s?43\.000/);
    expect(t.lines[1]).toMatchObject({ quantity: 1, detail: "1× Roti" });
    expect(t.showLine).toBe("Tunjukin ke kasir pas ambil pesanan.");
    expect(t.trackAt).toBe("bunnye.vercel.app/lacak");
  });

  it("follows the order: paid, cancelled, and brought to campus by the team", () => {
    expect(ticketContent({ ...ORDER, paymentStatus: "PAID" }, "B", "h").statusChip).toBe("Lunas");
    expect(ticketContent({ ...ORDER, status: "CANCELLED" }, "B", "h").statusChip).toBe("Dibatalkan");

    const campus = ticketContent({ ...ORDER, handoverLocation: "CAMPUS_B" }, "B", "h");
    expect(campus.shownTo).toBe("tim kami");
    expect(campus.showLine).toMatch(/diantar/);
  });
});

describe("ticketFileName", () => {
  it("names the file after the order, with nothing a file system would refuse", () => {
    expect(ticketFileName("PO-7KX4QM")).toBe("Tiket-PO-7KX4QM.png");
    expect(ticketFileName("PO/7K:X4")).toBe("Tiket-PO7KX4.png");
  });
});

describe("wrapText", () => {
  // One unit per character: easy to reason about.
  const measure = (s: string) => s.length;

  it("breaks between words, never past the width", () => {
    expect(wrapText("Rumah kos Jl. Merpati 12", 10, measure)).toEqual(["Rumah kos", "Jl.", "Merpati 12"]);
  });

  it("cuts a word too long for any line", () => {
    const lines = wrapText("Supercalifragilistic ok", 8, measure);
    expect(lines.every((line) => line.length <= 8)).toBe(true);
    expect(lines.join("").replace(/\s/g, "")).toBe("Supercalifragilisticok");
  });

  it("gives nothing for empty text", () => {
    expect(wrapText("   ", 10, measure)).toEqual([]);
  });
});
