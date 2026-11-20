// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentSheet } from "@/components/kasir/payment-sheet";
import { ToastProvider } from "@/components/ui/use-toast";

afterEach(cleanup);

const QRIS = "/gambar/qris-booth";
const PROOF = "/api/bukti-bayar/po-1";

function renderSheet(paymentProofUrl: string | null) {
  const onSubmit = vi.fn(async () => ({ ok: true as const, data: null }));
  render(
    <ToastProvider>
      <PaymentSheet
        total={36_000}
        qrisImageUrl={QRIS}
        fixedMethod="QRIS"
        paymentProofUrl={paymentProofUrl}
        submitLabels={{ CASH: "Pembayaran diterima", QRIS: "QRIS masuk, tandai lunas" }}
        onClose={() => {}}
        onSubmit={onSubmit}
      />
    </ToastProvider>,
  );
  return onSubmit;
}

describe("PaymentSheet: a QRIS preorder", () => {
  it("whose customer sent a receipt shows the receipt to check, not the booth's QRIS", async () => {
    const onSubmit = renderSheet(PROOF);

    expect(screen.getByRole("img", { name: "Bukti bayar QRIS dari pelanggan" }).getAttribute("src")).toBe(PROOF);
    expect(screen.queryByRole("img", { name: "Kode QRIS booth" })).toBeNull();
    expect(screen.getByText(/sudah bayar QRIS dari HP-nya/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Bukti cocok, tandai lunas" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ method: "QRIS", cashReceived: null }));
  });

  it("can still show the booth's QRIS when the receipt does not match", () => {
    renderSheet(PROOF);

    fireEvent.click(screen.getByRole("button", { name: "Bukti nggak cocok? Tunjukkan QRIS booth" }));

    expect(screen.getByRole("img", { name: "Kode QRIS booth" }).getAttribute("src")).toBe(QRIS);
  });

  it("without a receipt shows the booth's QRIS to pay with, as before", () => {
    renderSheet(null);

    expect(screen.getByRole("img", { name: "Kode QRIS booth" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Bukti bayar QRIS dari pelanggan" })).toBeNull();
    expect(screen.getByRole("button", { name: "QRIS masuk, tandai lunas" })).toBeTruthy();
  });
});
