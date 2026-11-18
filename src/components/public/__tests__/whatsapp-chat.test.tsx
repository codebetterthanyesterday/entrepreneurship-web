// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ChatCard,
  ChatHoursNote,
  ChatLink,
  HeaderChat,
  WhatsappProvider,
  type WhatsappContact,
} from "@/components/public/whatsapp-chat";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const CONTACT: WhatsappContact = {
  number: "6281234567890",
  brand: "Bunnyè",
  openMinute: 8 * 60,
  closeMinute: 21 * 60,
};

const withContact = (ui: React.ReactNode, contact: WhatsappContact | null = CONTACT) =>
  render(<WhatsappProvider contact={contact}>{ui}</WhatsappProvider>);

describe("ChatLink", () => {
  it("opens WhatsApp to the team, the order's message typed in", () => {
    withContact(
      <ChatLink intent={{ kind: "order", order: { orderNumber: "PO-0003" } }}>Chat soal pesanan ini</ChatLink>,
    );
    const link = screen.getByRole("link", { name: /Chat soal pesanan ini/ });
    const href = new URL(link.getAttribute("href")!);
    expect(href.origin + href.pathname).toBe("https://wa.me/6281234567890");
    expect(href.searchParams.get("text")).toContain("No. pesanan: PO-0003");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("is not there when the team has no number", () => {
    withContact(<ChatLink intent={{ kind: "general" }}>Tanya</ChatLink>, null);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("is not there outside the provider either", () => {
    render(<ChatLink intent={{ kind: "general" }}>Tanya</ChatLink>);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("ChatCard", () => {
  it("does not promise a chat it cannot open", () => {
    withContact(
      <ChatCard title="Ada yang mau ditanyain?" body="…" intent={{ kind: "general" }} cta="Chat" />,
      null,
    );
    expect(screen.queryByText("Ada yang mau ditanyain?")).toBeNull();
  });
});

describe("HeaderChat", () => {
  it("is named for a screen reader", () => {
    withContact(<HeaderChat />);
    expect(screen.getByRole("link", { name: "Tanya kami lewat WhatsApp" })).toBeTruthy();
  });
});

describe("ChatHoursNote", () => {
  it("gives the hours while the team is answering", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T03:00:00Z")); // 10.00 WIB
    withContact(<ChatHoursNote />);
    await act(async () => {});
    expect(screen.getByText("Dibalas jam 08.00–21.00 WIB.")).toBeTruthy();
  });

  it("says when it will be answered, outside those hours", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T16:00:00Z")); // 23.00 WIB
    withContact(<ChatHoursNote />);
    await act(async () => {});
    expect(screen.getByText(/di luar jam balas.*mulai 08\.00 WIB/i)).toBeTruthy();
  });
});
