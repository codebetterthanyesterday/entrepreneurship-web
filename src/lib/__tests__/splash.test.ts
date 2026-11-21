import { describe, expect, it } from "vitest";
import { shouldShowSplash } from "@/lib/splash";

const PHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("shouldShowSplash", () => {
  it("plays on every customer page opened afresh, not once a session", () => {
    expect(shouldShowSplash({ skip: false, userAgent: PHONE })).toBe(true);
  });

  it("is left out when the request asks to skip it, as the end-to-end tests do", () => {
    expect(shouldShowSplash({ skip: true, userAgent: PHONE })).toBe(false);
  });

  it("is never shown to a crawler, or the splash is what gets indexed", () => {
    expect(
      shouldShowSplash({
        skip: false,
        userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      }),
    ).toBe(false);
    // A link pasted into WhatsApp is fetched for its preview card.
    expect(shouldShowSplash({ skip: false, userAgent: "WhatsApp/2.23.20.0 A" })).toBe(false);
  });

  it("plays when the request names no browser at all", () => {
    expect(shouldShowSplash({ skip: false, userAgent: null })).toBe(true);
  });
});
