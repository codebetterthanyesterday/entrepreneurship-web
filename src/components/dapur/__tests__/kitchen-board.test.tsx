// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/use-toast";
import { KitchenBoard } from "@/components/dapur/kitchen-board";
import type { KitchenQueueResponse, KitchenStatus, KitchenTicket } from "@/types/order-view";

// The board imports a server action, which cannot be loaded in a test process.
// These tests are about what the board shows, not about what it submits.
vi.mock("@/actions/kitchen.actions", () => ({
  transitionFromKitchenAction: vi.fn(async () => ({ ok: true, data: {} })),
}));

function ticket(overrides: Partial<KitchenTicket> = {}): KitchenTicket {
  return {
    id: "t1",
    orderNumber: "OS-0001",
    channel: "ONSITE",
    customerName: "Pelanggan booth",
    status: "IN_QUEUE" as KitchenStatus,
    notes: null,
    queuedAt: new Date().toISOString(),
    startedAt: null,
    createdAt: new Date().toISOString(),
    items: [{ name: "Es Kopi Susu", quantity: 2, needsPrep: true }],
    ...overrides,
  };
}

type Scenario = { kind: "ok"; body: KitchenQueueResponse } | { kind: "offline" };

let scenario: Scenario;
const fetchMock = vi.fn(async () => {
  const current = scenario;
  if (current.kind === "offline") throw new TypeError("Failed to fetch");
  return { ok: true, status: 200, json: async () => current.body } as unknown as Response;
});

function renderBoard(initialTickets: KitchenTicket[]) {
  return render(
    // A cache of its own per test. SWR's default cache is global and the board
    // polls one fixed key, so without this a test would open holding whatever
    // the previous test had fetched.
    <SWRConfig value={{ provider: () => new Map() }}>
      <ToastProvider>
        <KitchenBoard initialTickets={initialTickets} canAct />
      </ToastProvider>
    </SWRConfig>,
  );
}

beforeEach(() => {
  fetchMock.mockClear();
  scenario = { kind: "ok", body: { tickets: [] } };
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * The failure the guide calls certain rather than possible: venue WiFi drops
 * for a moment while the board is open.
 *
 * `usePolling` has its own tests for keeping data through a failed fetch. This
 * one is about the assembled screen, because that is where the damage would
 * actually show — a cook standing in front of an empty board cannot tell
 * "nothing to make" from "nothing loaded", and the orders do not stop existing
 * because the router did.
 */
describe("KitchenBoard — when the connection drops", () => {
  it("keeps every ticket on screen and says the connection is gone", async () => {
    const served = ticket({ id: "t1", orderNumber: "OS-0001" });
    const polled = ticket({ id: "t2", orderNumber: "OS-0002", customerName: "Rizky" });

    // Start from the server-rendered board, then let a poll bring a second
    // ticket, so what survives the outage is polled data and not just the
    // fallback the component was constructed with.
    scenario = { kind: "ok", body: { tickets: [served, polled] } };
    renderBoard([served]);

    // Every ticket is in the DOM twice — the mobile column and the desktop
    // board are both rendered, and CSS decides which one is seen.
    expect((await screen.findAllByText("OS-0001")).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getAllByText("OS-0002").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Tersambung").length).toBeGreaterThan(0);

    // The WiFi goes.
    scenario = { kind: "offline" };

    await waitFor(
      () => expect(screen.getAllByText(/Koneksi putus/).length).toBeGreaterThan(0),
      { timeout: 15_000 },
    );

    // The whole point: both tickets are still there.
    expect(screen.getAllByText("OS-0001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("OS-0002").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rizky").length).toBeGreaterThan(0);

    // And the board never claims the queue emptied.
    expect(screen.queryAllByText(/Antrian kosong/)).toHaveLength(0);
    expect(screen.getAllByText(/nunggu dikerjain/).length).toBeGreaterThan(0);
  });

  it("goes back to 'Tersambung' when the WiFi returns", async () => {
    const served = ticket();

    scenario = { kind: "ok", body: { tickets: [served] } };
    renderBoard([served]);
    await screen.findAllByText("OS-0001");

    scenario = { kind: "offline" };
    await waitFor(
      () => expect(screen.getAllByText(/Koneksi putus/).length).toBeGreaterThan(0),
      { timeout: 15_000 },
    );

    scenario = { kind: "ok", body: { tickets: [served] } };
    await waitFor(
      () => expect(screen.getAllByText("Tersambung").length).toBeGreaterThan(0),
      { timeout: 15_000 },
    );

    expect(screen.getAllByText("OS-0001").length).toBeGreaterThan(0);
  });

  it("still shows an empty column as empty when the queue really is empty", async () => {
    // The counterpart to the test above: "keep what you have" must not turn
    // into "never show the empty state", or the board would lie the other way.
    scenario = { kind: "ok", body: { tickets: [] } };
    renderBoard([]);

    expect((await screen.findAllByText(/Antrian kosong/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Nggak ada yang perlu dikerjain/).length).toBeGreaterThan(0);
  });
});
