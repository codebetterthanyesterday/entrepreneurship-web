/**
 * What each actor can walk to, and which item the current URL belongs to.
 *
 * The model is areas, not roles. A role decides which areas an actor may open —
 * that list has to agree with `routes.ts`, and `navigation.test.ts` checks that
 * it does — but what the bar *shows* is decided by the area the actor is
 * standing in: the screens of that area, then a divider, then one link per other
 * area they are allowed into.
 *
 * Going by area rather than by role is what makes an admin at the till a
 * cashier. Listing the whole till as a single admin destination looked tidier
 * and quietly cost the admin the preorder tab, which is the screen they are
 * most likely to want when they step in to cover a break.
 *
 * This module is pure so it can be tested without a browser; `StaffNav` and
 * `PublicNav` are the thin client wrappers that feed it a pathname.
 */

export type NavIcon =
  | "ringkasan"
  | "pesanan"
  | "menu"
  | "pengaturan"
  | "kasir"
  | "dapur"
  | "rumah"
  | "katalog"
  | "keranjang"
  | "lacak";

/** Which counter an item shows, when it shows one. */
export type NavBadge = "preorder" | "cart";

export interface NavItem {
  href: string;
  /** The label on a wide screen, where the row has room for the full phrase. */
  label: string;
  /** The label in the bottom bar, where up to six of these share one phone width. */
  shortLabel?: string;
  icon: NavIcon;
  /**
   * Route subtrees that also mark this item as the current page.
   *
   * `href` itself always matches exactly and is never treated as a subtree, so
   * "/" does not light up on every page, and "/kasir" does not light up on
   * "/kasir/preorder" — the till has a tab for each, and only one of them can be
   * the current page.
   */
  subtrees?: readonly string[];
  badge?: NavBadge;
  /**
   * A link out of the area the rest of the row is about. Drawn apart — after a
   * divider, in sky rather than pink — because following it changes which
   * screens the bar is showing.
   */
  crossArea?: boolean;
}

interface NavArea {
  /** The area's root. A cross-area link points here. */
  base: string;
  /** How the area is named when it is somewhere else to go. */
  label: string;
  icon: NavIcon;
  items: readonly NavItem[];
}

const AREAS = {
  admin: {
    base: "/admin",
    label: "Admin",
    icon: "ringkasan",
    items: [
      { href: "/admin", label: "Ringkasan", icon: "ringkasan" },
      { href: "/admin/pesanan", label: "Pesanan", icon: "pesanan" },
      { href: "/admin/menu", label: "Menu", icon: "menu" },
      {
        href: "/admin/pengaturan",
        label: "Pengaturan",
        shortLabel: "Setelan",
        icon: "pengaturan",
      },
    ],
  },
  kasir: {
    base: "/kasir",
    label: "Kasir",
    icon: "kasir",
    items: [
      {
        href: "/kasir",
        label: "Pesanan baru",
        shortLabel: "Pesanan",
        icon: "kasir",
      },
      {
        href: "/kasir/preorder",
        label: "Preorder",
        icon: "pesanan",
        badge: "preorder",
      },
    ],
  },
  dapur: {
    base: "/dapur",
    label: "Dapur",
    icon: "dapur",
    // One screen. On its own that is a label rather than navigation, so a
    // kitchen phone signed in as DAPUR gets no bar at all and keeps the height
    // — see `roleHasNav`. An admin standing at the pass still gets one, because
    // for them this item comes with links back out.
    items: [{ href: "/dapur", label: "Dapur", icon: "dapur" }],
  },
} as const satisfies Record<string, NavArea>;

type AreaKey = keyof typeof AREAS;

/**
 * Which areas each role may open.
 *
 * ADMIN first, because the order here is the order of the cross-area links, and
 * "back to the dashboard" is the one an admin covering a shift reaches for.
 */
const AREAS_BY_ROLE: Readonly<Record<string, readonly AreaKey[]>> = {
  ADMIN: ["admin", "kasir", "dapur"],
  KASIR: ["kasir"],
  DAPUR: ["dapur"],
};

function isUnder(base: string, pathname: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function crossAreaLink(key: AreaKey): NavItem {
  const area = AREAS[key];

  return {
    href: area.base,
    label: area.label,
    icon: area.icon,
    subtrees: [area.base],
    crossArea: true,
  };
}

/**
 * The bar for a staff member, as it should look on this URL: the current area's
 * screens, then one link per other area they may open.
 */
export function staffNavFor(role: string, pathname: string): readonly NavItem[] {
  const keys = AREAS_BY_ROLE[role] ?? [];
  if (keys.length === 0) return [];

  // A staff URL is always inside one of the actor's areas — this layout does not
  // render anywhere else — but fall back to their first area rather than to an
  // empty bar if that ever stops being true.
  const currentKey = keys.find((key) => isUnder(AREAS[key].base, pathname)) ?? keys[0]!;

  return [
    ...AREAS[currentKey].items,
    ...keys.filter((key) => key !== currentKey).map(crossAreaLink),
  ];
}

/**
 * Whether this role ever gets a bar.
 *
 * The staff layout has to reserve the page's bottom padding before a pathname is
 * available to it, so this answers from the role alone: DAPUR never gets one,
 * every other staff role always does.
 */
export function roleHasNav(role: string): boolean {
  const keys = AREAS_BY_ROLE[role] ?? [];

  return keys.length > 1 || (keys.length === 1 && AREAS[keys[0]!].items.length > 1);
}

/** Whether this role's own area holds the preorder counter the badge needs. */
export function roleNeedsPreorderCount(role: string): boolean {
  return (AREAS_BY_ROLE[role] ?? []).includes("kasir");
}

/**
 * The customer's four stops.
 *
 * "/" is the company profile and the catalogue lives at "/menu" — so "Tentang"
 * comes first, matching the URL a QR code or a shared link lands on.
 */
export const PUBLIC_NAV: readonly NavItem[] = [
  { href: "/", label: "Tentang", icon: "rumah" },
  { href: "/menu", label: "Menu", icon: "katalog" },
  {
    href: "/keranjang",
    label: "Keranjang",
    icon: "keranjang",
    // Checkout is the bag with a form on it, not a fourth place to be.
    subtrees: ["/checkout"],
    badge: "cart",
  },
  {
    href: "/lacak",
    label: "Lacak pesanan",
    shortLabel: "Lacak",
    icon: "lacak",
    // A single order's page is where "lacak" lands you.
    subtrees: ["/pesanan"],
  },
];

/**
 * Whether a bar is worth its space. One destination is not navigation — it is a
 * label, and the page heading is already that.
 */
export function hasSomewhereToGo(items: readonly NavItem[]): boolean {
  return items.length >= 2;
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;

  return (item.subtrees ?? []).some((base) => isUnder(base, pathname));
}

/** Every staff href the navigation can produce, for the test that checks them against `routes.ts`. */
export function allStaffHrefs(role: string): readonly string[] {
  const keys = AREAS_BY_ROLE[role] ?? [];

  return keys.flatMap((key) => [AREAS[key].base, ...AREAS[key].items.map((item) => item.href)]);
}

/** The area roots, so the test can assert a role is offered every area it may open. */
export const AREA_BASES: readonly string[] = Object.values(AREAS).map((area) => area.base);
