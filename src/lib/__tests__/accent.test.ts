import { describe, expect, it } from "vitest";
import { accentCookie, isAutomatedAgent, parseAccent } from "@/lib/accent";

describe("parseAccent", () => {
  it("accepts the two moods", () => {
    expect(parseAccent("pink")).toBe("pink");
    expect(parseAccent("blue")).toBe("blue");
  });

  it("treats anything else as not answered, so the visitor is asked again", () => {
    // A forged or stale cookie must not pin someone to a mood they never chose.
    for (const value of [undefined, null, "", "Blue", "male", "pink; x=1"]) {
      expect(parseAccent(value)).toBeNull();
    }
  });
});

describe("accentCookie", () => {
  it("lasts a year and is readable across the whole site", () => {
    const cookie = accentCookie("blue", false);

    expect(cookie).toMatch(/^accent=blue;/);
    expect(cookie).toContain("path=/");
    expect(cookie).toContain(`max-age=${60 * 60 * 24 * 365}`);
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
  });

  it("is Secure over HTTPS", () => {
    expect(accentCookie("pink", true)).toMatch(/; Secure$/);
  });
});

describe("isAutomatedAgent", () => {
  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "WhatsApp/2.23.20.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome-Lighthouse",
  ])("recognises %s", (userAgent) => {
    expect(isAutomatedAgent(userAgent)).toBe(true);
  });

  it.each([
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  ])("asks a real browser: %s", (userAgent) => {
    expect(isAutomatedAgent(userAgent)).toBe(false);
  });

  it("asks when there is no user agent at all", () => {
    expect(isAutomatedAgent(null)).toBe(false);
  });
});
