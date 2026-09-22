// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrackView } from "@/components/public/track-view";
import { REMEMBERED_ORDER_KEY } from "@/lib/remembered-order";
import type { TrackedOrder } from "@/types/order-view";

const ORDER: TrackedOrder = {
  orderNumber: "PO-0012",
  customerName: "Rani",
  pickupSlot: "10:30",
  paymentMethod: "CASH",
  paymentStatus: "UNPAID",
  status: "IN_PROGRESS",
  notes: null,
  totalAmount: 36000,
  needsPrep: true,
  items: [{ name: "Es Kopi", quantity: 2, priceAtOrder: 18000, subtotal: 36000 }],
};

/** Answers the order only for the right pair, like the real endpoint. */
function stubApi(order: TrackedOrder = ORDER) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const params = new URL(String(input), "http://localhost").searchParams;
    const hit = params.get("no") === order.orderNumber && params.get("wa") === "7890";
    return new Response(JSON.stringify({ order: hit ? order : null }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderTracker(props: React.ComponentProps<typeof TrackView> = {}) {
  // A fresh SWR cache per test, or one test's order leaks into the next.
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <TrackView {...props} />
    </SWRConfig>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TrackView", () => {
  it("opens straight onto the order this device remembers", async () => {
    stubApi();
    window.localStorage.setItem(
      REMEMBERED_ORDER_KEY,
      JSON.stringify({ orderNumber: "PO-0012", phoneLast4: "7890" }),
    );

    renderTracker();

    expect(await screen.findByRole("heading", { level: 1, name: "Lagi diracik" })).toBeTruthy();
    expect(screen.getByText("Tahap 3 dari 5")).toBeTruthy();
    expect(screen.queryByLabelText("Nomor pesanan")).toBeNull();
  });

  it("asks for the pair when nothing is remembered, and remembers a hit", async () => {
    stubApi();
    renderTracker();

    fireEvent.change(await screen.findByLabelText("Nomor pesanan"), {
      target: { value: "po-0012" },
    });
    fireEvent.change(screen.getByLabelText("4 digit terakhir WhatsApp"), {
      target: { value: "7890" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Lagi diracik" })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(REMEMBERED_ORDER_KEY)!)).toEqual({
      orderNumber: "PO-0012",
      phoneLast4: "7890",
    });
  });

  it("says so on a miss, without remembering anything", async () => {
    stubApi();
    renderTracker();

    fireEvent.change(await screen.findByLabelText("Nomor pesanan"), {
      target: { value: "PO-0012" },
    });
    fireEvent.change(screen.getByLabelText("4 digit terakhir WhatsApp"), {
      target: { value: "1111" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));

    expect(await screen.findByText("Nggak ketemu")).toBeTruthy();
    expect(window.localStorage.getItem(REMEMBERED_ORDER_KEY)).toBeNull();
  });

  it("forgets the order and goes back to the form on 'Ganti pesanan'", async () => {
    stubApi();
    window.localStorage.setItem(
      REMEMBERED_ORDER_KEY,
      JSON.stringify({ orderNumber: "PO-0012", phoneLast4: "7890" }),
    );
    renderTracker();

    fireEvent.click(await screen.findByRole("button", { name: "Ganti pesanan" }));

    expect(await screen.findByLabelText("Nomor pesanan")).toBeTruthy();
    expect(window.localStorage.getItem(REMEMBERED_ORDER_KEY)).toBeNull();
  });

  it("lets a link to a different order win over the remembered one", async () => {
    const fetchMock = stubApi();
    window.localStorage.setItem(
      REMEMBERED_ORDER_KEY,
      JSON.stringify({ orderNumber: "PO-0012", phoneLast4: "7890" }),
    );
    renderTracker({ initialOrderNumber: "PO-0099" });

    const field = (await screen.findByLabelText("Nomor pesanan")) as HTMLInputElement;
    expect(field.value).toBe("PO-0099");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the number to hand over once the order is ready", async () => {
    stubApi({ ...ORDER, status: "READY" });
    window.localStorage.setItem(
      REMEMBERED_ORDER_KEY,
      JSON.stringify({ orderNumber: "PO-0012", phoneLast4: "7890" }),
    );
    renderTracker();

    expect(await screen.findByRole("heading", { level: 1, name: "Siap diambil!" })).toBeTruthy();
    expect(screen.getByText("Tunjukin ke kasir")).toBeTruthy();
  });
});
