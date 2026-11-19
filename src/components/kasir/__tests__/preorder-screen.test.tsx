// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CashierPreorder } from "@/types/order-view";

const markLocationNotifiedAction = vi.hoisted(() =>
  vi.fn<(orderId: unknown) => Promise<{ ok: true; data: { orderNumber: string } }>>(async () => ({ ok: true, data: { orderNumber: "PO-0042" } })),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/actions/kasir.actions", () => ({
  markAsPaidAction: vi.fn(async () => ({ ok: true, data: {} })),
  transitionOrderAction: vi.fn(async () => ({ ok: true, data: {} })),
  markLocationNotifiedAction: (orderId: unknown) => markLocationNotifiedAction(orderId),
}));

// The camera is the browser's; the test stands in for it and hands the
// screen what a scan would have read.
const scanner = vi.hoisted(() => ({ onScan: null as ((text: string) => string | null) | null, open: false }));
vi.mock("@/components/kasir/qr-scanner", () => ({
  QrScanner: (props: { open: boolean; onScan: (text: string) => string | null }) => {
    scanner.open = props.open;
    scanner.onScan = props.onScan;
    return props.open ? <div role="dialog" aria-label="Scan QR tiket" /> : null;
  },
}));

const { PreorderScreen } = await import("@/components/kasir/preorder-screen");
const { ToastProvider } = await import("@/components/ui/use-toast");
const { formatRupiah } = await import("@/lib/utils");

afterEach(cleanup);

/**
 * formatRupiah's output as Testing Library sees page text: it turns the
 * non-breaking space after "Rp" into a plain one before matching.
 */
const rp = (amount: number) => formatRupiah(amount).replace(/\u00a0/g, " ");

function preorder(overrides: Partial<CashierPreorder> = {}): CashierPreorder {
  return {
    id: "order-1",
    orderNumber: "PO-0042",
    customerName: "Nadia Prameswari",
    pickupSlot: "09.00 - 10.00",
    serviceDate: null,
    handoverLocation: null,
    handoverDetail: null,
    awaitingLocationCheck: false,
    paymentMethod: "CASH",
    paymentStatus: "UNPAID",
    paymentProofUrl: null,
    customerPhone: "081234567890",
    locationNotifiedAt: null,
    status: "CONFIRMED",
    notes: null,
    totalAmount: 36_000,
    itemCount: 2,
    needsPrep: false,
    items: [
      { name: "Es Kopi Aren", quantity: 2, priceAtOrder: 18_000, subtotal: 36_000, needsPrep: false },
    ],
    photobooth: [],
    ...overrides,
  };
}

function open(order: CashierPreorder) {
  render(
    <ToastProvider>
      <PreorderScreen preorders={[order]} qrisImageUrl={null} brand="Bunnyè" />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByText(order.customerName));
}

describe("PreorderScreen: photobooth charges (BPB-098)", () => {
  it("shows them as already paid at the booth, apart from the food the cashier collects", () => {
    open(
      preorder({
        photobooth: [{ key: "c1", description: "Cetak 4R ×2", amount: 16_000 }],
      }),
    );

    const section = screen.getByRole("region", { name: /Photobooth/ });
    expect(within(section).getByText("lunas di booth")).toBeTruthy();
    expect(within(section).getByText("Cetak 4R ×2")).toBeTruthy();
    expect(within(section).getByText(/Jangan ditagih lagi/)).toBeTruthy();
    expect(within(section).getByText(rp(52_000))).toBeTruthy();

    // What the cashier collects is still the food total.
    const total = screen.getAllByText("Total").at(0)!.parentElement!;
    expect(within(total).getByText(rp(36_000))).toBeTruthy();
  });

  it("says nothing about the photobooth when there are no charges", () => {
    open(preorder());
    expect(screen.queryByRole("region", { name: /Photobooth/ })).toBeNull();
  });
});

describe("PreorderScreen: chatting the customer", () => {
  const FUTURE = "2099-01-10";
  const textOf = (link: HTMLElement) => new URL(link.getAttribute("href")!).searchParams.get("text") ?? "";

  it("opens WhatsApp to the customer's number, signed and naming the order", () => {
    open(preorder({ serviceDate: FUTURE, handoverLocation: "CAMPUS_B" }));
    const section = screen.getByRole("region", { name: "Chat pelanggan" });
    const link = within(section).getByRole("link", { name: /Pesanan lagi diantar/ });
    const href = new URL(link.getAttribute("href")!);
    expect(href.origin + href.pathname).toBe("https://wa.me/6281234567890");
    expect(textOf(link)).toContain("Halo Nadia Prameswari, ini Bunnyè.");
    expect(textOf(link)).toContain("PO-0042");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("asks for a landmark while a Lainnya location is being checked", () => {
    open(preorder({ serviceDate: FUTURE, handoverLocation: "OTHER", handoverDetail: "Kos Melati", awaitingLocationCheck: true }));
    const links = within(screen.getByRole("region", { name: "Chat pelanggan" })).getAllByRole("link");
    expect(links[0]!.textContent).toContain("Minta patokan lokasi");
  });

  it("flags a Lainnya customer not yet told, and marks them told when the verdict is sent", () => {
    markLocationNotifiedAction.mockClear();
    open(preorder({ serviceDate: FUTURE, handoverLocation: "OTHER", handoverDetail: "Kos Melati" }));
    expect(screen.getAllByText(/belum dikabari/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("link", { name: /Kabari: lokasi diterima/ }));
    expect(markLocationNotifiedAction).toHaveBeenCalledWith("order-1");
  });

  it("says when a Lainnya customer was told, and asks nothing more", () => {
    open(
      preorder({
        serviceDate: FUTURE,
        handoverLocation: "OTHER",
        handoverDetail: "Kos Melati",
        locationNotifiedAt: "2099-01-09T07:05:00Z",
      }),
    );
    expect(screen.getByText(/udah dikabari hasil cek lokasinya/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Udah dikabari" })).toBeNull();
  });

  it("explains, rather than offering a dead link, when there is no number", () => {
    open(preorder({ customerPhone: null }));
    const section = screen.getByRole("region", { name: "Chat pelanggan" });
    expect(within(section).queryByRole("link")).toBeNull();
    expect(within(section).getByText(/nggak punya nomor WhatsApp/)).toBeTruthy();
  });
});

describe("PreorderScreen: scanning the customer's ticket", () => {
  function screenWith(orders: CashierPreorder[]) {
    render(
      <ToastProvider>
        <PreorderScreen preorders={orders} qrisImageUrl={null} brand="Bunnyè" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Scan QR/ }));
  }

  it("opens the scanned order's sheet, even when the list is filtered away from it", () => {
    const nadia = preorder({ id: "o1", orderNumber: "PO-7KX4QM", customerName: "Nadia" });
    const rani = preorder({ id: "o2", orderNumber: "PO-B4N8TZ", customerName: "Rani" });
    screenWith([nadia, rani]);
    fireEvent.change(screen.getByLabelText("Cari nomor pesanan atau nama pelanggan"), {
      target: { value: "Rani" },
    });

    let answer: string | null = "unset";
    React.act(() => {
      answer = scanner.onScan!("PO-7KX4QM");
    });

    expect(answer).toBeNull();
    expect(scanner.open).toBe(false);
    expect(screen.getByRole("dialog", { name: "Pesanan PO-7KX4QM" })).toBeDefined();
  });

  it("keeps scanning and says why when the QR is not one of the preorders", () => {
    screenWith([preorder({ orderNumber: "PO-7KX4QM" })]);

    const answer = scanner.onScan!("https://example.com/qris");

    expect(answer).toMatch(/bukan QR tiket/);
    expect(scanner.open).toBe(true);
  });
});

