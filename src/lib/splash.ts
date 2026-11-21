/**
 * Present on a request that must not get the splash. The app never sets it:
 * it is how the end-to-end tests, which open dozens of pages, skip a screen
 * they are not about.
 *
 * In its own module rather than next to `SplashScreen`: the public layout — a
 * server component — reads this name to decide whether to render the splash at
 * all, and a value imported from a `"use client"` file arrives on the server as
 * a reference to the client module, not as the string.
 */
export const SPLASH_COOKIE = "bunnye_skip_splash";

/**
 * What the splash used to set on every visitor to mean "seen this session".
 * Phones keep session cookies for days, so it is still on the devices that
 * opened the shop before; it must not be read as a request to skip.
 */
export const RETIRED_SEEN_COOKIE = "bunnye_splash";

/** Crawlers are never shown the splash, or it is what they would index. */
const CRAWLER = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview/i;

/**
 * Whether this request gets the splash: every customer page opened afresh
 * does, so the shop always opens the same way. Never a crawler, and never a
 * request carrying the skip cookie.
 */
export function shouldShowSplash(input: { skip: boolean; userAgent: string | null }): boolean {
  if (input.skip) return false;
  return !CRAWLER.test(input.userAgent ?? "");
}
