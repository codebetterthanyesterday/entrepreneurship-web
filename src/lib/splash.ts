/**
 * Set once the splash screen has played, so it shows once per browser session.
 *
 * In its own module rather than next to `SplashScreen`: the public layout — a
 * server component — reads this name to decide whether to render the splash at
 * all, and a value imported from a `"use client"` file arrives on the server as
 * a reference to the client module, not as the string.
 */
export const SPLASH_COOKIE = "bunnye_splash";

/** Crawlers are never shown the splash, or it is what they would index. */
const CRAWLER = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview/i;

/**
 * Whether this request should get the splash: only a visitor who has not seen
 * it this session, and never a crawler.
 */
export function shouldShowSplash(input: { seen: boolean; userAgent: string | null }): boolean {
  if (input.seen) return false;
  return !CRAWLER.test(input.userAgent ?? "");
}
