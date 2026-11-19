// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const update = vi.hoisted(() => vi.fn());
vi.mock("@/actions/kasir.actions", () => ({
  updateOrderDetailsAction: (input: unknown) => update(input),
}));

const { OrderEditSheet } = await import("@/components/staff/order-edit-sheet");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const SCHEDULE = {
  cutoffMinute: 21 * 60,
  days: [
    {
      date: "2026-11-22",
      locations: ["CAMPUS_B" as const, "MARKET_DAY" as const],
      windows: [
        { id: "w1", label: "10.00 - 11.00", remaining: 0, isFull: true },
        { id: "w2", label: "11.00 - 12.00", remaining: 0, isFull: true },
      ],
    },
  ],
};

const ORDER = {
  id: "o1",
  orderNumber: "PO-7KX4QM",
  channel: "PREORDER" as const,
  status: "CONFIRMED",
  customerName: "Rani",
  customerPhone: "081234561234",
  serviceDate: "2026-11-22",
  serviceWindowId: "w1",
  handoverLocation: "MARKET_DAY",
  handoverDetail: null,
};

function renderSheet(order = ORDER) {
  const onSaved = vi.fn();
  render(<OrderEditSheet order={order} schedule={SCHEDULE} onClose={() => {}} onSaved={onSaved} />);
  return onSaved;
}

describe("OrderEditSheet", () => {
  it("keeps the order's own time range choosable though it is full, and no other full one", () => {
    renderSheet();

    expect((screen.getByRole("button", { name: /10\.00 - 11\.00/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: /11\.00 - 12\.00/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /10\.00 - 11\.00/ }).textContent).toContain("Jadwal sekarang");
  });

  it("sends only the name and number when the handover is left as it was", async () => {
    update.mockResolvedValue({ ok: true, data: { orderNumber: "PO-7KX4QM" } });
    const onSaved = renderSheet();

    fireEvent.change(screen.getByLabelText("Nama pelanggan"), { target: { value: "Rani Putri" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("PO-7KX4QM"));
    expect(update).toHaveBeenCalledWith({
      orderId: "o1",
      customerName: "Rani Putri",
      customerPhone: "081234561234",
      schedule: null,
    });
  });

  it("asks for a new date and hour when the new place is not served on the old date", async () => {
    renderSheet({ ...ORDER, handoverLocation: "CAMPUS_B" });

    fireEvent.click(screen.getByRole("button", { name: /Lainnya/ }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));

    expect(await screen.findByText("Pilih lokasi, tanggal, dan jamnya dulu ya")).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("once the customer has come, offers the name and number only", () => {
    renderSheet({ ...ORDER, status: "IN_QUEUE" });

    expect(screen.queryByRole("button", { name: /10\.00 - 11\.00/ })).toBeNull();
    expect(screen.getByText(/jadwal dan lokasinya nggak bisa diubah lagi/)).toBeTruthy();
  });
});
