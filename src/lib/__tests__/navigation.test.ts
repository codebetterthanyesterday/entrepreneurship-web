import { describe, expect, it } from "vitest";
import {
  AREA_BASES,
  allStaffHrefs,
  hasSomewhereToGo,
  isNavItemActive,
  PUBLIC_NAV,
  roleNeedsPreorderCount,
  STAFF_ACCOUNT_ITEM,
  staffNavFor,
  staffTabsFor,
} from "@/lib/navigation";
import { mayReach, PROTECTED_ROUTES } from "@/lib/routes";

const STAFF_ROLES = ["ADMIN", "KASIR", "DAPUR"] as const;

/**
 * The navigation's side of the agreement described in `routes.ts`.
 *
 * A menu that offers a screen the proxy then bounces to /403 is worse than no
 * menu: the actor taps something that looks available and is thrown out of the
 * app. These tests read the same table the proxy reads, so adding a staff area
 * without wiring it into the navigation — or handing a role a link it is not
 * allowed to follow — fails here rather than during service.
 */
describe("staff navigation against the role table", () => {
  it.each(STAFF_ROLES)("never offers %s a route the proxy would refuse", (role) => {
    for (const href of allStaffHrefs(role)) {
      expect(mayReach(role, href), `${role} is offered ${href}`).toBe(true);
    }
  });

  it.each(STAFF_ROLES)("offers %s every area the role may open", (role) => {
    const offered = new Set(allStaffHrefs(role));

    for (const base of AREA_BASES) {
      if (!mayReach(role, base)) continue;
      expect(offered.has(base), `${role} may open ${base} but has no link to it`).toBe(true);
    }
  });

  it("covers every protected area with a navigable area of its own", () => {
    // A new entry in the proxy's table with no area behind it is a screen that
    // can only be reached by typing its URL — the thing this work removed.
    for (const area of Object.keys(PROTECTED_ROUTES)) {
      expect(AREA_BASES, `${area} is protected but is not a navigation area`).toContain(area);
    }
  });
});

describe("staff navigation follows the area, not only the role", () => {
  it("gives a cashier their two tabs and nothing else", () => {
    const items = staffNavFor("KASIR", "/kasir");

    expect(items.map((item) => item.href)).toEqual(["/kasir", "/kasir/preorder"]);
    expect(items.some((item) => item.crossArea)).toBe(false);
  });

  it("gives an admin on a dashboard page the dashboard plus a way to each area", () => {
    const items = staffNavFor("ADMIN", "/admin/menu");

    expect(items.filter((item) => !item.crossArea).map((item) => item.href)).toEqual([
      "/admin",
      "/admin/pesanan",
      "/admin/menu",
      "/admin/pengaturan",
    ]);
    expect(items.filter((item) => item.crossArea).map((item) => item.href)).toEqual([
      "/kasir",
      "/dapur",
    ]);
  });

  it("gives an admin standing at the till the till's screens, preorder included", () => {
    // The whole reason the bar follows the area: an admin covering a break is a
    // cashier, and the preorder list is the screen they came for.
    for (const pathname of ["/kasir", "/kasir/preorder"]) {
      const items = staffNavFor("ADMIN", pathname);

      expect(items.filter((item) => !item.crossArea).map((item) => item.href)).toEqual([
        "/kasir",
        "/kasir/preorder",
      ]);
      expect(items.filter((item) => item.crossArea).map((item) => item.href)).toEqual([
        "/admin",
        "/dapur",
      ]);
    }
  });

  it("puts every cross-area link after every screen of the current area", () => {
    // `NavBar` draws one divider, at the first cross-area item, so the groups
    // must not interleave.
    const items = staffNavFor("ADMIN", "/dapur");
    const firstCross = items.findIndex((item) => item.crossArea);

    expect(firstCross).toBeGreaterThan(-1);
    expect(items.slice(firstCross).every((item) => item.crossArea)).toBe(true);
  });

  it("gives an unknown role nothing at all", () => {
    expect(staffNavFor("PELANGGAN", "/kasir")).toEqual([]);
    expect(staffTabsFor("PELANGGAN", "/kasir")).toEqual([]);
  });
});

describe("whether a bar is drawn", () => {
  it("gives the kitchen phone a bar too, its one screen and the account", () => {
    expect(hasSomewhereToGo(staffNavFor("DAPUR", "/dapur"))).toBe(false);
    expect(staffTabsFor("DAPUR", "/dapur").map((item) => item.href)).toEqual(["/dapur", "/akun"]);
  });

  it("adds the account tab to the till, whose bar has room for it", () => {
    expect(staffTabsFor("KASIR", "/kasir").map((item) => item.href)).toEqual([
      "/kasir",
      "/kasir/preorder",
      "/akun",
    ]);
  });

  it("leaves an admin's six-wide bar alone; the avatar is their way to Akun", () => {
    const tabs = staffTabsFor("ADMIN", "/admin");
    expect(tabs).toHaveLength(6);
    expect(tabs).not.toContain(STAFF_ACCOUNT_ITEM);
  });

  /**
   * The staff layout pads every page for the bar without knowing the role or
   * the URL. That is only right while every role, everywhere it may stand, is
   * actually given one.
   */
  it.each(STAFF_ROLES)("gives %s a bar on every screen it can reach", (role) => {
    const everywhere = ["/admin", "/admin/pesanan", "/kasir", "/kasir/preorder", "/dapur"];
    const reachable = everywhere.filter((pathname) => mayReach(role, pathname));

    for (const pathname of reachable) {
      expect(hasSomewhereToGo(staffTabsFor(role, pathname)), `${role} at ${pathname}`).toBe(true);
    }
  });

  it("only ever offers the account a route every role may open", () => {
    for (const role of STAFF_ROLES) {
      expect(mayReach(role, STAFF_ACCOUNT_ITEM.href), role).toBe(true);
    }
  });

  it("reads the preorder count only for the roles whose bar can show it", () => {
    expect(roleNeedsPreorderCount("KASIR")).toBe(true);
    expect(roleNeedsPreorderCount("ADMIN")).toBe(true);
    expect(roleNeedsPreorderCount("DAPUR")).toBe(false);
  });
});

describe("which item is the current page", () => {
  const item = (href: string) => {
    const found = PUBLIC_NAV.find((entry) => entry.href === href);
    if (!found) throw new Error(`${href} is not in the customer navigation`);
    return found;
  };

  it("does not light the menu up on every page, because '/' is a prefix of all of them", () => {
    expect(isNavItemActive(item("/"), "/")).toBe(true);
    expect(isNavItemActive(item("/"), "/keranjang")).toBe(false);
    expect(isNavItemActive(item("/"), "/lacak")).toBe(false);
  });

  it("opens on the menu: the first customer stop is the catalogue at '/'", () => {
    expect(PUBLIC_NAV[0]).toMatchObject({ href: "/", label: "Menu" });
    expect(PUBLIC_NAV.map((entry) => entry.label)).not.toContain("Tentang");
  });

  it("marks exactly one customer stop on every customer page", () => {
    for (const pathname of ["/", "/keranjang", "/checkout", "/lacak", "/pesanan/PO-0001"]) {
      const active = PUBLIC_NAV.filter((entry) => isNavItemActive(entry, pathname));

      expect(active.map((entry) => entry.href), pathname).toHaveLength(1);
    }
  });

  it("keeps the bag lit through checkout, which is the bag with a form on it", () => {
    expect(isNavItemActive(item("/keranjang"), "/checkout")).toBe(true);
  });

  it("keeps tracking lit on a single order's page", () => {
    expect(isNavItemActive(item("/lacak"), "/pesanan/NGD-20260921-001")).toBe(true);
  });

  it("does not light a sibling whose name merely starts the same way", () => {
    // "/keranjang" must not answer for "/keranjangku", and "/lacak" must not
    // answer for a hypothetical "/lacakan" — the subtree test is on "/" too.
    expect(isNavItemActive(item("/keranjang"), "/keranjangku")).toBe(false);
    expect(isNavItemActive(item("/lacak"), "/pesananku")).toBe(false);
  });

  it("marks exactly one cashier tab at a time", () => {
    const tabs = staffNavFor("KASIR", "/kasir/preorder");
    const active = tabs.filter((tab) => isNavItemActive(tab, "/kasir/preorder"));

    expect(active.map((tab) => tab.href)).toEqual(["/kasir/preorder"]);
  });

  it.each(["/admin", "/admin/pesanan", "/admin/menu", "/admin/pengaturan", "/kasir", "/dapur"])(
    "marks exactly one admin item on %s",
    (pathname) => {
      const active = staffNavFor("ADMIN", pathname).filter((item) =>
        isNavItemActive(item, pathname),
      );

      expect(active).toHaveLength(1);
    },
  );
});
