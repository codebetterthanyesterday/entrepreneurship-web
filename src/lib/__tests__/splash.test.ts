import { describe, expect, it } from "vitest";
import { shouldShowSplash } from "@/lib/splash";

const PHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("shouldShowSplash", () => {
  it("plays for a visitor who has not seen it this session", () => {
    expect(shouldShowSplash({ seen: false, userAgent: PHONE })).toBe(true);
  });

  it("does not play twice in one session", () => {
    expect(shouldShowSplash({ seen: true, userAgent: PHONE })).toBe(false);
  });

  it("is never shown to a crawler, or the splash is what gets indexed", () => {
    expect(
      shouldShowSplash({
        seen: false,
        userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      }),
    ).toBe(false);
    // A link pasted into WhatsApp is fetched for its preview card.
    expect(shouldShowSplash({ seen: false, userAgent: "WhatsApp/2.23.20.0 A" })).toBe(false);
  });

  it("plays when the request names no browser at all", () => {
    expect(shouldShowSplash({ seen: false, userAgent: null })).toBe(true);
  });
});
