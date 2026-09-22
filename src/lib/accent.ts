/**
 * The customer's colour mood, chosen once on their first visit.
 *
 * On arrival the customer is asked whether they are a woman or a man, and the
 * answer picks the mood of every customer page: pink (the brand as it has always
 * been) or blue. What is stored is the *mood*, never the answer itself — the
 * cookie says `blue`, not `male`. Nothing about it reaches the server beyond the
 * cookie the browser sends back, and no order or table ever records it.
 *
 * The staff screens do not take part. A cashier's tablet that a customer once
 * used to browse the menu must not turn the till blue, so only the public
 * layout reads this cookie — see `AccentRoot`.
 */

export const ACCENTS = ["pink", "blue"] as const;
export type Accent = (typeof ACCENTS)[number];

/** The mood a visitor sees before choosing, and after skipping. */
export const DEFAULT_ACCENT: Accent = "pink";

export const ACCENT_COOKIE = "accent";

/** A year. Long enough that the question really is a first-visit question. */
export const ACCENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The stored mood, or `null` when the visitor has not answered yet.
 *
 * Anything that is not one of the known moods counts as unanswered rather than
 * as pink: a cookie left over from an older release, or edited by hand, should
 * ask again instead of silently pinning the visitor to a default they never
 * picked.
 */
export function parseAccent(value: string | undefined | null): Accent | null {
  return (ACCENTS as readonly string[]).includes(value ?? "") ? (value as Accent) : null;
}

/**
 * The `document.cookie` assignment that records a choice.
 *
 * `Secure` only over HTTPS, so the cookie still sticks on `http://localhost`
 * during development. Lax is enough: nothing about it is sensitive, and it has
 * to survive the customer following a WhatsApp link back to their order.
 */
export function accentCookie(accent: Accent, secure: boolean): string {
  return (
    `${ACCENT_COOKIE}=${accent}; path=/; max-age=${ACCENT_COOKIE_MAX_AGE}; SameSite=Lax` +
    (secure ? "; Secure" : "")
  );
}

/**
 * Crawlers, link-preview fetchers and audit tools, which never answer and never
 * keep a cookie — so without this, every one of them would index or screenshot
 * the welcome screen instead of the page.
 */
const AUTOMATED_AGENT =
  /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|lighthouse|pagespeed|headlesschrome/i;

export function isAutomatedAgent(userAgent: string | null | undefined): boolean {
  return !!userAgent && AUTOMATED_AGENT.test(userAgent);
}

/** Name for the cross-tab channel, so a choice made in one tab repaints the rest. */
export const ACCENT_CHANNEL = "accent";
