/**
 * The words the staff header and strip use to say where somebody is.
 *
 * Each staff area is a "world" of the Snack Kingdom, the same game map the
 * customer side walks through: the admin's dashboard is World HQ, the till is
 * the Counter Station and the kitchen is the Kitchen Castle. The strip under the
 * header reads "{world} · {screen}", so a phone left on the counter says which
 * screen it is on from across the tent.
 *
 * Pure, so it can be tested without a browser.
 */

type Role = "ADMIN" | "KASIR" | "DAPUR";

interface World {
  base: string;
  name: string;
}

const WORLD_BY_ROLE: Readonly<Record<Role, World>> = {
  ADMIN: { base: "/admin", name: "World HQ" },
  KASIR: { base: "/kasir", name: "Counter Station" },
  DAPUR: { base: "/dapur", name: "Kitchen Castle" },
};

/** The short pill under the brand name: which seat this account sits in. */
const ROLE_PILL: Readonly<Record<Role, string>> = {
  ADMIN: "HQ · Admin",
  KASIR: "Counter · Kasir",
  DAPUR: "Kitchen · Dapur",
};

/** Exact paths first; the order matters only for readability. */
const SCREEN_NAME: Readonly<Record<string, string>> = {
  "/admin": "Ringkasan",
  "/admin/pesanan": "Pesanan",
  "/admin/menu": "Menu & stok",
  "/admin/pengaturan": "Pengaturan",
  "/kasir": "Pesanan baru",
  "/kasir/preorder": "Preorder",
  "/dapur": "Papan dapur",
  "/akun": "Akun",
  "/inbox": "Inbox",
};

function isRole(role: string): role is Role {
  return role in WORLD_BY_ROLE;
}

export function displayRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

export function rolePill(role: string): string {
  return isRole(role) ? ROLE_PILL[role] : displayRole(role);
}

/** Where the brand in the header leads: the first screen of the role's own area. */
export function homeFor(role: string): string {
  return isRole(role) ? WORLD_BY_ROLE[role].base : "/";
}

/**
 * The world a URL belongs to. It goes by the area, not by who is signed in, so
 * an admin covering the till reads "Counter Station"; /akun belongs to nobody's
 * area and takes the role's own world.
 */
export function worldFor(role: string, pathname: string): string {
  const byArea = Object.values(WORLD_BY_ROLE).find(
    (world) => pathname === world.base || pathname.startsWith(`${world.base}/`),
  );
  if (byArea) return byArea.name;

  return isRole(role) ? WORLD_BY_ROLE[role].name : "Bunnyè";
}

export function screenNameFor(pathname: string): string {
  return SCREEN_NAME[pathname] ?? "";
}

/** "World HQ · Ringkasan" — what the strip says. */
export function stripLabel(role: string, pathname: string): string {
  const screen = screenNameFor(pathname);
  const world = worldFor(role, pathname);

  return screen ? `${world} · ${screen}` : world;
}
