import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import {
  chatHoursLabel,
  chatOrderOf,
  composeChatMessage,
  isWithinChatHours,
  toWhatsappNumber,
  whatsappChatUrl,
} from "@/lib/whatsapp";
import { updateSettingsSchema } from "@/lib/validations/setting.schema";

const at = (wib: string) => Temporal.ZonedDateTime.from(`${wib}[Asia/Jakarta]`).toInstant();
const HOURS = { openMinute: 8 * 60, closeMinute: 21 * 60 };

describe("toWhatsappNumber", () => {
  it.each([
    ["081234567890", "6281234567890"],
    ["0812-3456-7890", "6281234567890"],
    ["+62 812 3456 7890", "6281234567890"],
    ["6281234567890", "6281234567890"],
    // Typed without the leading zero: this used to produce a link with no country code.
    ["81234567890", "6281234567890"],
    ["+65 9123 4567", "6591234567"],
  ])("reads %s as %s", (raw, expected) => {
    expect(toWhatsappNumber(raw)).toBe(expected);
  });

  it.each([null, undefined, "", "12345", "abc", "1234567890", "0812345678901234567"])(
    "refuses %s",
    (raw) => {
      expect(toWhatsappNumber(raw)).toBeNull();
    },
  );
});

describe("whatsappChatUrl", () => {
  it("encodes the message, new lines and all", () => {
    const url = whatsappChatUrl("081234567890", "Halo!\nNo. pesanan: PO-0001 & co");
    expect(url).toBe("https://wa.me/6281234567890?text=Halo!%0ANo.%20pesanan%3A%20PO-0001%20%26%20co");
  });

  it("has no link without a usable number", () => {
    expect(whatsappChatUrl("", "Halo")).toBeNull();
  });
});

describe("chat hours", () => {
  it("is open from the opening minute up to, not including, the closing one", () => {
    expect(isWithinChatHours(HOURS, at("2026-11-20T07:59"))).toBe(false);
    expect(isWithinChatHours(HOURS, at("2026-11-20T08:00"))).toBe(true);
    expect(isWithinChatHours(HOURS, at("2026-11-20T20:59"))).toBe(true);
    expect(isWithinChatHours(HOURS, at("2026-11-20T21:00"))).toBe(false);
  });

  it("goes by Jakarta's clock, whatever the instant's zone", () => {
    // 01.30 UTC is 08.30 in Jakarta.
    expect(isWithinChatHours(HOURS, Temporal.Instant.from("2026-11-20T01:30:00Z"))).toBe(true);
  });

  it("is written the way the page shows it", () => {
    expect(chatHoursLabel(HOURS)).toBe("08.00–21.00 WIB");
  });
});

describe("composeChatMessage", () => {
  const order = chatOrderOf({
    orderNumber: "PO-0016",
    serviceDate: "2026-11-21",
    pickupSlot: "13.00 - 14.00",
    handoverLocation: "OTHER",
    handoverDetail: "Kos Melati",
    totalAmount: 18000,
  });

  it("names the order and its schedule, so nobody has to ask which", () => {
    const text = composeChatMessage("Bunnyè", { kind: "order", order });
    expect(text).toContain("Halo Bunnyè!");
    expect(text).toContain("No. pesanan: PO-0016");
    expect(text).toContain("Jadwal: Sabtu, 21 Nov 2026 · 13.00 - 14.00 · Lainnya · Kos Melati");
    expect(text.endsWith("Pertanyaanku: ")).toBe(true);
  });

  it("asks for a landmark on a location still being checked", () => {
    const text = composeChatMessage("Bunnyè", { kind: "location", order });
    expect(text).toContain("patokan lokasi");
    expect(text).toContain("PO-0016");
  });

  it("carries the total on a payment question, and nothing else of the order", () => {
    const text = composeChatMessage("Bunnyè", { kind: "payment", order });
    expect(text).toMatch(/Total: Rp\s?18\.000/);
    expect(text).not.toContain("Kos Melati");
  });

  it("leaves out the schedule line for an order without one", () => {
    const text = composeChatMessage("Bunnyè", { kind: "cancelled", order: { orderNumber: "PO-0002" } });
    expect(text).toContain("PO-0002");
    expect(text).not.toContain("Jadwal:");
  });

  it("names the failing page and its error code", () => {
    expect(composeChatMessage("Bunnyè", { kind: "pageError", path: "/checkout", digest: "abc123" })).toBe(
      "Halo Bunnyè! Halaman /checkout gagal dimuat terus nih (kode: abc123).",
    );
  });

  it("asks only what is needed to find a lost order", () => {
    const text = composeChatMessage("Bunnyè", { kind: "forgotNumber" });
    expect(text).toContain("Atas nama: ");
    expect(text).not.toMatch(/\d{4}/);
  });
});

describe("chatOrderOf", () => {
  it("keeps only the fields a message may name", () => {
    const view = chatOrderOf({
      orderNumber: "PO-0001",
      customerPhone: "081234567890",
      paymentProofUrl: "/gambar/x",
    } as Parameters<typeof chatOrderOf>[0]);
    expect(Object.keys(view).sort()).toEqual(
      ["handoverDetail", "handoverLocation", "orderNumber", "pickupSlot", "serviceDate"].sort(),
    );
  });
});

describe("updateSettingsSchema — chat hours", () => {
  it("accepts a day's hours", () => {
    expect(updateSettingsSchema.safeParse({ chatOpenMinute: 480, chatCloseMinute: 1260 }).success).toBe(true);
  });

  it("refuses hours that end before they start", () => {
    const result = updateSettingsSchema.safeParse({ chatOpenMinute: 1260, chatCloseMinute: 480 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["chatCloseMinute"]);
  });
});
