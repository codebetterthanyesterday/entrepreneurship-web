import * as React from "react";
import type { NavIcon } from "@/lib/navigation";

/**
 * The navigation's glyphs, drawn inline rather than pulled from an icon package.
 *
 * Nine small paths are not worth a dependency, and drawing them here keeps them
 * on `currentColor` — which is what lets one item switch from ink-soft to white
 * on a pink fill without the icon needing to know it happened. They are
 * decoration next to a label that already says the same thing, so every one of
 * them is `aria-hidden`.
 */
const PATHS: Record<NavIcon, React.ReactNode> = {
  // A bar chart: the dashboard is figures.
  ringkasan: (
    <>
      <path d="M4 20V13" />
      <path d="M9.5 20V5" />
      <path d="M15 20v-9" />
      <path d="M20.5 20V8" />
    </>
  ),
  // A torn-off receipt with lines on it.
  pesanan: (
    <>
      <path d="M6 3h12v18l-3-1.8-3 1.8-3-1.8L6 21V3z" />
      <path d="M9.5 8.5h5" />
      <path d="M9.5 12.5h5" />
    </>
  ),
  // A cookie: the thing being sold.
  menu: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5h.01" />
      <path d="M14.5 10.5h.01" />
      <path d="M10.5 15h.01" />
      <path d="M14.5 14.5h.01" />
    </>
  ),
  // Sliders, not a cog — the settings page is a list of switches.
  pengaturan: (
    <>
      <path d="M4 7h5" />
      <path d="M13 7h7" />
      <path d="M4 17h7" />
      <path d="M15 17h5" />
      <circle cx="11" cy="7" r="2" />
      <circle cx="13" cy="17" r="2" />
    </>
  ),
  // A till: a drawer with a slot and a key.
  kasir: (
    <>
      <path d="M3.5 8h17v10.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V8z" />
      <path d="M3.5 12.5h17" />
      <path d="M8 16.5h3" />
      <path d="M7 8V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V8" />
    </>
  ),
  // A pan on the heat, with steam coming off it.
  dapur: (
    <>
      <path d="M3.5 11.5h12V16a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 16v-4.5z" />
      <path d="M15.5 12.5h4a1.25 1.25 0 0 1 0 2.5h-4" />
      <path d="M7 8c0-1.5 1.5-1.5 1.5-3" />
      <path d="M11.5 8c0-1.5 1.5-1.5 1.5-3" />
    </>
  ),
  // A house: the profile is the business's front door.
  rumah: (
    <>
      <path d="M4 10.5L12 4l8 6.5V20H4v-9.5z" />
      <path d="M9.5 20v-5.5h5V20" />
    </>
  ),
  // A storefront awning: the catalogue is the shop.
  katalog: (
    <>
      <path d="M4.5 10v9.5h15V10" />
      <path d="M3 10l2-5.5h14L21 10H3z" />
      <path d="M9.5 19.5V14h5v5.5" />
    </>
  ),
  // A paper bag with handles.
  keranjang: (
    <>
      <path d="M5.5 8h13l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H8.2a1.5 1.5 0 0 1-1.5-1.3L5.5 8z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  // A map pin.
  lacak: (
    <>
      <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
};

export function NavIconGlyph({ name, className }: { name: NavIcon; className?: string }) {
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
