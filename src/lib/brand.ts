/**
 * The brand, in one place.
 *
 * Every page title, the login screen, the boundary pages and the default
 * profile copy read the name from here rather than spelling it out, so it is
 * written once.
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
 * typefaces — lives in the identity block at the top of
 * `src/app/globals.css` and in `src/app/layout.tsx`. Between those three files
 * there is no brand anywhere else in the codebase, bar the logo itself:
 * `BrandMark` and `public/brand/`, and the tab icons in `src/app/`.
 */
export const BRAND_NAME = "Bunnyè";

/**
 * The same name in a form safe for a filename. Used for the CSV exports, which
 * land in an admin's downloads folder where a space or an accent is a nuisance.
 */
export const BRAND_SLUG = "bunnye";

/**
 * A browser-tab title.
 *
 * `pageTitle()` on its own is the site's own title; with a page it reads
 * "Kasir — Bunnyè". The separator is an em dash everywhere, because it used
 * to be a hyphen on four pages and an em dash on the other ten.
 */
export function pageTitle(page?: string): string {
  return page ? `${page} — ${BRAND_NAME}` : BRAND_NAME;
}
