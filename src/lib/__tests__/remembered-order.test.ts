import { describe, expect, it } from "vitest";
import { lastFourDigits, parseRememberedOrder } from "@/lib/remembered-order";

describe("lastFourDigits", () => {
  it("ignores spaces, dashes and a leading +", () => {
    expect(lastFourDigits("+62 812-3456-7890")).toBe("7890");
  });

  it("refuses a number too short to have four", () => {
    expect(lastFourDigits("123")).toBeNull();
    expect(lastFourDigits(null)).toBeNull();
  });
});

describe("parseRememberedOrder", () => {
  it("reads back what was stored", () => {
    const raw = JSON.stringify({ orderNumber: "PO-0012", phoneLast4: "7890" });
    expect(parseRememberedOrder(raw)).toEqual({ orderNumber: "PO-0012", phoneLast4: "7890" });
  });

  it("treats anything malformed as nothing remembered", () => {
    for (const raw of [
      null,
      "",
      "not json",
      "[]",
      JSON.stringify({ orderNumber: "PO-1" }),
      JSON.stringify({ orderNumber: "", phoneLast4: "7890" }),
      JSON.stringify({ orderNumber: "PO-1", phoneLast4: "78" }),
      JSON.stringify({ orderNumber: "PO-1", phoneLast4: "78a0" }),
    ]) {
      expect(parseRememberedOrder(raw)).toBeNull();
    }
  });
});
