// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toast } from "@/components/ui/toast";
import { ToastProvider } from "@/components/ui/use-toast";
import { OrderBrowser } from "@/components/admin/order-browser";
import type { AdminOrder } from "@/types/order-view";

type CancelResult = { ok: true; data: { orderNumber: string } } | { ok: false; error: string };

const cancelOrderAction = vi.fn<(input: unknown) => Promise<CancelResult>>(async () => ({
  ok: true,
  data: { orderNumber: "PO-0001" },
}));
const refresh = vi.fn();

// The browser imports a server action, which cannot be loaded in a test
// process. These tests are about what the screen shows and what it submits.
vi.mock("@/actions/admin.actions", () => ({
  cancelOrderAction: (input: unknown) => cancelOrderAction(input),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function order(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "o1",
    orderNumber: "PO-0001",
    channel: "PREORDER",
    status: "CONFIRMED",
    customerName: "Rani",
    customerPhone: "081234567890",
    pickupSlot: "09.00 - 10.00",
    paymentMethod: "CASH",
    paymentStatus: "UNPAID",
    notes: "Pedas ya",
    totalAmount: 25_000,
    itemCount: 3,
    handledByName: null,
    items: [
      { name: "Cimol", quantity: 2, priceAtOrder: 7_500, subtotal: 15_000 },
      { name: "Es Teh", quantity: 1, priceAtOrder: 10_000, subtotal: 10_000 },
    ],
    timeline: {
      createdAt: "2026-09-20T02:05:00Z",
      queuedAt: null,
      startedAt: null,
      readyAt: null,
      completedAt: null,
    },
    canCancel: true,
    ...overrides,
  };
}

function renderBrowser(orders: AdminOrder[]) {
  return render(
    <ToastProvider>
      <OrderBrowser orders={orders} />
      {/* The app renders the toast in the root layout; the browser only calls it. */}
      <Toast />
    </ToastProvider>,
  );
}

function openDetail(orderNumber: string) {
  fireEvent.click(screen.getByLabelText(`Lihat detail pesanan ${orderNumber}`));
}

beforeEach(() => {
  cancelOrderAction.mockClear();
  refresh.mockClear();
});

afterEach(cleanup);

describe("order cards", () => {
  it("summarises each order without being opened", () => {
    renderBrowser([order()]);

    expect(screen.getByText("PO-0001")).toBeDefined();
    expect(screen.getByText("Rani · 3 item")).toBeDefined();
    expect(screen.getByText("2× Cimol, 1× Es Teh")).toBeDefined();
    expect(screen.getByText(/25\.000/)).toBeDefined();
  });

  it("flags an unpaid order", () => {
    renderBrowser([order()]);

    expect(screen.getByText("belum bayar")).toBeDefined();
  });

  it("does not chase payment on a voided order", () => {
    // It was never going to be paid; the cancellation is the story, not the
    // outstanding balance.
    renderBrowser([order({ status: "CANCELLED", paymentStatus: "UNPAID" })]);

    expect(screen.getByText("Dibatalkan")).toBeDefined();
    expect(screen.queryByText("belum bayar")).toBeNull();
  });

  it("offers something to do when the filter matches nothing", () => {
    renderBrowser([]);

    expect(screen.getByText("Nggak ada pesanan di sini")).toBeDefined();
  });
});

describe("detail sheet", () => {
  it("prices each line at what was charged, not at the menu's price today", () => {
    renderBrowser([order()]);
    openDetail("PO-0001");

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("2× Cimol")).toBeDefined();
    expect(within(dialog).getByText(/@ Rp\s?7\.500/)).toBeDefined();
  });

  it("shows the payment, pickup slot, notes and who handled it", () => {
    renderBrowser([order({ handledByName: "Nadia" })]);
    openDetail("PO-0001");

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Belum bayar")).toBeDefined();
    expect(within(dialog).getByText("09.00 - 10.00")).toBeDefined();
    expect(within(dialog).getByText("Pedas ya")).toBeDefined();
    expect(within(dialog).getByText("Nadia")).toBeDefined();
  });

  it("marks a stage the order never reached rather than leaving it blank", () => {
    renderBrowser([order()]);
    openDetail("PO-0001");

    const dialog = screen.getByRole("dialog");
    for (const stage of ["Dibuat", "Masuk antrian", "Mulai diracik", "Siap", "Selesai"]) {
      expect(within(dialog).getByText(stage)).toBeDefined();
    }
    // Four stages not yet reached, plus the empty "Ditangani" row.
    expect(within(dialog).getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  it("reads timestamps in Jakarta time", () => {
    // 02:05 UTC is 09:05 in Jakarta. A UTC reading would misreport the event.
    renderBrowser([order()]);
    openDetail("PO-0001");

    expect(within(screen.getByRole("dialog")).getByText(/09\.05/)).toBeDefined();
  });
});

describe("cancelling", () => {
  it("asks for confirmation and warns that stock comes back", () => {
    renderBrowser([order()]);
    openDetail("PO-0001");

    fireEvent.click(screen.getByText("Batalkan pesanan"));

    expect(screen.getByText(/stok tiap menunya bakal otomatis dibalikin/i)).toBeDefined();
    expect(cancelOrderAction).not.toHaveBeenCalled();
  });

  it("does nothing if the confirmation is dismissed", () => {
    renderBrowser([order()]);
    openDetail("PO-0001");

    fireEvent.click(screen.getByText("Batalkan pesanan"));
    fireEvent.click(screen.getByText("Nggak jadi"));

    expect(cancelOrderAction).not.toHaveBeenCalled();
    expect(screen.getByText("Batalkan pesanan")).toBeDefined();
  });

  it("sends only the order id, and pulls the list again afterwards", async () => {
    renderBrowser([order()]);
    openDetail("PO-0001");

    fireEvent.click(screen.getByText("Batalkan pesanan"));
    fireEvent.click(screen.getByText("Ya, batalin"));

    await waitFor(() => expect(cancelOrderAction).toHaveBeenCalledWith({ orderId: "o1" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("reports a refusal instead of pretending it worked", async () => {
    cancelOrderAction.mockResolvedValueOnce({
      ok: false,
      error: "Pesanan yang udah selesai nggak bisa dibatalin",
    });

    renderBrowser([order()]);
    openDetail("PO-0001");

    fireEvent.click(screen.getByText("Batalkan pesanan"));
    fireEvent.click(screen.getByText("Ya, batalin"));

    await waitFor(() =>
      expect(screen.getByText("Pesanan yang udah selesai nggak bisa dibatalin")).toBeDefined(),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("offers no cancel button where the server would refuse one", () => {
    // `canCancel` comes from the transition table on the server, so a status
    // with no CANCELLED edge never grows a button here.
    renderBrowser([order({ status: "DONE", canCancel: false })]);
    openDetail("PO-0001");

    expect(screen.queryByText("Batalkan pesanan")).toBeNull();
  });
});
