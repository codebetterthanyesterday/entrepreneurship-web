/**
 * The brand, in one place.
 *
 * The business has no name yet, so nothing in this app is allowed to spell one
 * out. Every page title, the login screen, the boundary pages and the default
 * profile copy read from here instead — pick a name, change these two values,
 * and the whole app follows.
 *
 * The placeholder is deliberately not a plausible name. "Nama Usaha" cannot be
 * mistaken for a decision and cannot be shipped by accident without somebody
 * noticing it in a browser tab.
 *
 * Two things deliberately do *not* read from here:
 *
 *   - `STORAGE_KEY` in `src/hooks/use-cart.ts` keeps its old `ngd-` prefix.
 *     Renaming it silently empties the cart of every customer who has one open,
 *     and nobody ever sees the key.
 *   - The seeded staff e-mail addresses in `prisma/seed.ts`. Renaming them
 *     changes the credentials the team logs in with, for no visible gain.
 *
 * The visual half of the identity — the accent colour, the surfaces and the two
 * typefaces — lives in the PLACEHOLDER IDENTITY block at the top of
 * `src/app/globals.css` and in `src/app/layout.tsx`. Between those three files
 * there is no brand anywhere else in the codebase.
 */
export const BRAND_NAME = "Nama Usaha";

/**
 * The same name in a form safe for a filename. Used for the CSV exports, which
 * land in an admin's downloads folder where a space or an accent is a nuisance.
 */
export const BRAND_SLUG = "nama-usaha";

/**
 * A browser-tab title.
 *
 * `pageTitle()` on its own is the site's own title; with a page it reads
 * "Kasir — Nama Usaha". The separator is an em dash everywhere, because it used
 * to be a hyphen on four pages and an em dash on the other ten.
 */
export function pageTitle(page?: string): string {
  return page ? `${page} — ${BRAND_NAME}` : BRAND_NAME;
}
