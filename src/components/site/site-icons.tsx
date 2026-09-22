import * as React from "react";

/**
 * The icon choices for a profile "keunggulan" card.
 *
 * A closed set rather than free text: the admin picks from these in edit mode,
 * so a typo cannot leave a card with no picture, and every glyph is drawn to the
 * same weight as the navigation's. `SITE_ICON_KEYS` is also what the stored
 * `icon` column is validated against at render time — an unknown value falls
 * back to the first entry rather than throwing on a page a customer is reading.
 */
const PATHS = {
  leaf: (
    <>
      <path d="M20 4c0 8.5-4.5 13-11 13H5.5C5.5 9 11 4 20 4z" />
      <path d="M4 21c0-5 3-9 8-11" />
    </>
  ),
  tag: (
    <>
      <path d="M13.5 3.5H20V10l-9.5 9.5a2 2 0 0 1-2.8 0l-4.2-4.2a2 2 0 0 1 0-2.8L13.5 3.5z" />
      <path d="M16.5 7h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-9.5A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.5C19 15.6 12 20 12 20z" />,
  star: (
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5z" />
  ),
  cup: (
    <>
      <path d="M4.5 6.5h11V15a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4V6.5z" />
      <path d="M15.5 8h2.8a1.7 1.7 0 0 1 0 3.4h-2.8" />
      <path d="M6 3.5c0 1-1 1-1 2" />
      <path d="M10 3.5c0 1-1 1-1 2" />
    </>
  ),
  hand: (
    <>
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M15 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-2a1.5 1.5 0 0 1 3 0" />
    </>
  ),
} satisfies Record<string, React.ReactNode>;

export type SiteIcon = keyof typeof PATHS;

export const SITE_ICON_KEYS = Object.keys(PATHS) as SiteIcon[];

export const DEFAULT_SITE_ICON: SiteIcon = "leaf";

/** Turns whatever is in the database into a glyph this build actually has. */
export function toSiteIcon(value: string | null | undefined): SiteIcon {
  if (value && value in PATHS) return value as SiteIcon;

  return DEFAULT_SITE_ICON;
}

export function SiteIconGlyph({ name, className }: { name: SiteIcon; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
