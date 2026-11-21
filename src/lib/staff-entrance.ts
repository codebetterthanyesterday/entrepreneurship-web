import { mayReach, protectedAreaOf } from "@/lib/routes";

/**
 * Keeping the staff side out of sight.
 *
 * The staff screens live at addresses anyone would guess (/admin, /kasir,
 * /dapur), and the sign-in page was at /login, so a curious visitor could find
 * the door and start trying passwords. Now:
 *
 *   - The sign-in page answers only at a secret address, `STAFF_LOGIN_PATH`
 *     (for example `/masuk-k7f3q9x2m4wd8h`). It is an environment variable, not
 *     code, because the repository is public, and it can be changed without a
 *     release. `/login` itself answers like any address that does not exist.
 *   - A staff screen opened without a session answers the same way, instead of
 *     sending the visitor to the sign-in page. Nothing tells a visitor that
 *     /admin is any different from /asdf.
 *
 * Signed-in staff are unaffected: their screens, links and redirects keep the
 * plain addresses, which only someone with a session can reach.
 *
 * This hides the door; it does not lock it. The password check, the role
 * check on every page and server action, and `requireRole` stay as they were.
 */

/** Where the sign-in page is built. Never served at this address once a secret one is set. */
export const LOGIN_ROUTE = "/login";

/**
 * Every staff address a visitor without a session must not be able to tell
 * apart from a missing page. The three role areas, the account page and the
 * inbox shared by all roles, and the "wrong door" page.
 */
export const STAFF_PATHS: readonly string[] = ["/admin", "/kasir", "/dapur", "/akun", "/inbox", "/403"];

/** One path segment of lowercase letters, digits and dashes, long enough not to be guessed. */
const SECRET_PATH = /^\/[a-z0-9][a-z0-9-]{11,63}$/;

/**
 * The sign-in page's public address: `STAFF_LOGIN_PATH` when it is set and
 * well formed, `/login` otherwise. Unset, as in development and tests,
 * everything works as before at /login; a malformed value is ignored rather
 * than locking the team out, and says so in the log.
 */
export function staffLoginPath(value: string | undefined = process.env.STAFF_LOGIN_PATH): string {
  const trimmed = value?.trim();
  if (!trimmed) return LOGIN_ROUTE;
  if (!SECRET_PATH.test(trimmed) || isUnder(trimmed, LOGIN_ROUTE) || STAFF_PATHS.some((path) => isUnder(trimmed, path))) {
    console.error(
      "STAFF_LOGIN_PATH is ignored: it must be one segment like /masuk-k7f3q9x2m4wd, 12 to 64 lowercase letters, digits or dashes",
    );
    return LOGIN_ROUTE;
  }
  return trimmed;
}

/** Whether `pathname` is `base` or below it, on a segment boundary (/admin, /admin/menu, not /administrasi). */
export function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isStaffPath(pathname: string): boolean {
  return STAFF_PATHS.some((path) => isUnder(pathname, path));
}

export type GateDecision =
  | { kind: "next" }
  /** Serve this internal route at the requested address. */
  | { kind: "rewrite"; to: string }
  /** Answer exactly as an address that does not exist would. */
  | { kind: "not-found" }
  | { kind: "redirect"; to: string };

/**
 * What the proxy does with a request, from its path and who is asking.
 * `role` is undefined for a visitor without a session.
 */
export function gateStaffRequest(
  pathname: string,
  { role, loginPath }: { role: string | undefined; loginPath: string },
): GateDecision {
  const hidden = loginPath !== LOGIN_ROUTE;

  if (hidden && pathname === loginPath) return { kind: "rewrite", to: LOGIN_ROUTE };
  if (hidden && isUnder(pathname, LOGIN_ROUTE)) return { kind: "not-found" };

  if (isStaffPath(pathname)) {
    if (role === undefined) return { kind: "not-found" };
    // Signed in, but this is another role's area: the "wrong door" page.
    if (protectedAreaOf(pathname) !== null && !mayReach(role, pathname)) {
      return { kind: "redirect", to: "/403" };
    }
  }

  return { kind: "next" };
}
