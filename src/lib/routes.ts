/**
 * Who may reach each staff area.
 *
 * ADMIN is on every staff route on purpose: an admin running the event has to
 * be able to step behind the till or the pass when someone needs a break, and
 * an admin who cannot open the screen they are supposed to be supervising is
 * useless during service. It does not run the other way — KASIR and DAPUR stay
 * out of /admin.
 *
 * Three things have to agree about this list: the proxy, which turns a request
 * away before the page renders; the `requireRole(...)` call at the top of each
 * page; and the navigation, which must not offer a screen that the proxy will
 * then bounce to /403. The proxy and the navigation both read the table from
 * here so that only the pages are left to keep in step by hand, and
 * `navigation.test.ts` checks the navigation against this table.
 */
export const PROTECTED_ROUTES: Readonly<Record<string, readonly string[]>> = {
  "/admin": ["ADMIN"],
  "/kasir": ["KASIR", "ADMIN"],
  "/dapur": ["DAPUR", "ADMIN"],
};

/**
 * The protected area a path falls in, or `null` when the path is open to all.
 *
 * `startsWith` rather than an exact match, because every screen below an area
 * is as protected as the area itself — /admin/pengaturan is not a public page
 * just because it is not spelled out in the table.
 */
export function protectedAreaOf(pathname: string): string | null {
  return Object.keys(PROTECTED_ROUTES).find((area) => pathname.startsWith(area)) ?? null;
}

/** Whether a role — `undefined` for a visitor who is not signed in — may open a path. */
export function mayReach(role: string | undefined, pathname: string): boolean {
  const area = protectedAreaOf(pathname);
  if (area === null) return true;
  return role !== undefined && PROTECTED_ROUTES[area]!.includes(role);
}
