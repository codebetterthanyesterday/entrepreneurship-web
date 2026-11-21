// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InboxItem } from "@/lib/inbox";
import { INBOX_DEVICE_KEY, parseDeviceState } from "@/lib/inbox-device";

const polled = vi.hoisted(() => ({ items: [] as InboxItem[] }));
vi.mock("@/hooks/use-polling", () => ({
  usePolling: () => ({ data: { items: polled.items }, isError: false, isLoading: false }),
}));
const chime = vi.hoisted(() => ({ play: vi.fn(), buzz: vi.fn(), unlock: vi.fn() }));
vi.mock("@/lib/inbox-chime", () => ({
  playChime: () => chime.play(),
  buzz: () => chime.buzz(),
  unlockChime: () => chime.unlock(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { InboxList } = await import("@/components/staff/inbox-list");
const { InboxBell } = await import("@/components/staff/inbox-bell");

const HOUR = 3_600_000;

function item(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    key: "qris-proof:PO-NEW",
    kind: "qris-proof",
    tone: "urgent",
    title: "Bukti QRIS masuk",
    detail: "PO-NEW · Rani",
    since: new Date().toISOString(),
    href: "/kasir/preorder?pesanan=PO-NEW",
    actionLabel: "Cek bukti",
    ...overrides,
  };
}

const stock = item({
  key: "stock-low:p1",
  kind: "stock-low",
  tone: "watch",
  title: "Stok menipis",
  detail: "Croffle · sisa 2",
  href: "/admin/menu",
});

const stored = () => parseDeviceState(window.localStorage.getItem(INBOX_DEVICE_KEY));

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InboxList, on this phone", () => {
  it("marks what happened since the inbox was last opened here as new", () => {
    // Last opened two hours ago.
    window.localStorage.setItem(INBOX_DEVICE_KEY, JSON.stringify({ openedAt: Date.now() - 2 * HOUR }));
    polled.items = [
      item(),
      item({ key: "ready:PO-OLD", kind: "ready", tone: "action", title: "Siap diserahkan", detail: "PO-OLD · Dimas", since: new Date(Date.now() - 3 * HOUR).toISOString() }),
    ];
    render(<InboxList initial={polled.items} />);

    expect(screen.getByRole("link", { name: /Bukti QRIS masuk.*baru/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Siap diserahkan/ }).textContent).not.toMatch(/baru/);
    // And this open is what the next one counts from.
    expect(stored().previousOpenedAt).toBeLessThan(Date.now() - HOUR);
  });

  it("puts a “Pantau” item off for an hour, and shows it again on request", () => {
    polled.items = [stock];
    render(<InboxList initial={polled.items} />);

    fireEvent.click(screen.getByRole("button", { name: "Tunda Stok menipis selama 1 jam" }));
    expect(screen.queryByRole("link", { name: /Stok menipis/ })).toBeNull();
    expect(screen.getByText("Ditunda (1)")).toBeTruthy();
    expect(Object.keys(stored().snoozed)).toEqual(["stock-low:p1"]);

    fireEvent.click(screen.getByRole("button", { name: "Tampilkan lagi" }));
    expect(screen.getByRole("link", { name: /Stok menipis/ })).toBeTruthy();
  });

  it("offers no way to put off work that needs doing", () => {
    polled.items = [item()];
    render(<InboxList initial={polled.items} />);
    expect(screen.queryByRole("button", { name: /^Tunda/ })).toBeNull();
  });

  it("turns the chime on for this phone, playing it once so the person hears it", () => {
    polled.items = [];
    render(<InboxList initial={[]} />);
    const toggle = screen.getByRole("switch", { name: "Bunyi dan getar waktu ada yang baru" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(toggle);

    expect(stored().alerts).toBe(true);
    expect(chime.unlock).toHaveBeenCalled();
    expect(chime.play).toHaveBeenCalledOnce();
  });
});

describe("InboxBell", () => {
  it("chimes once for new work on a phone that turned it on, and not again for the same", () => {
    window.localStorage.setItem(INBOX_DEVICE_KEY, JSON.stringify({ alerts: true }));
    polled.items = [item(), stock];
    const { rerender } = render(<InboxBell />);

    expect(chime.play).toHaveBeenCalledOnce();
    expect(chime.buzz).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Inbox, 1 perlu ditangani" })).toBeTruthy();

    polled.items = [item(), stock];
    act(() => rerender(<InboxBell />));
    expect(chime.play).toHaveBeenCalledOnce();
  });

  it("stays quiet on a phone that has not turned the chime on", () => {
    polled.items = [item()];
    render(<InboxBell />);
    expect(chime.play).not.toHaveBeenCalled();
    expect(within(screen.getByRole("link", { name: /^Inbox/ })).getByText("1")).toBeTruthy();
  });
});
