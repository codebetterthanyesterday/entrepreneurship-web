import { afterEach, describe, expect, it, vi } from "vitest";
import { gateStaffRequest, isStaffPath, staffLoginPath } from "@/lib/staff-entrance";

const SECRET = "/masuk-k7f3q9x2m4wd";
const visitor = { role: undefined, loginPath: SECRET };
const as = (role: string) => ({ role, loginPath: SECRET });

afterEach(() => vi.restoreAllMocks());

describe("a visitor without a session", () => {
  it("cannot tell a staff screen from a page that does not exist", () => {
    for (const path of ["/admin", "/admin/pengaturan", "/kasir", "/kasir/preorder", "/dapur", "/akun", "/inbox", "/403"]) {
      expect(gateStaffRequest(path, visitor)).toEqual({ kind: "not-found" });
    }
  });

  it("is never sent to the sign-in page, which would give its address away", () => {
    expect(gateStaffRequest("/kasir", visitor).kind).not.toBe("redirect");
  });

  it("finds nothing at /login once the secret address is set", () => {
    expect(gateStaffRequest("/login", visitor)).toEqual({ kind: "not-found" });
    expect(gateStaffRequest("/login/anything", visitor)).toEqual({ kind: "not-found" });
  });

  it("reaches the sign-in page at the secret address", () => {
    expect(gateStaffRequest(SECRET, visitor)).toEqual({ kind: "rewrite", to: "/login" });
  });

  it("still gets every customer page", () => {
    for (const path of ["/", "/keranjang", "/checkout", "/lacak", "/pesanan/PO-7KX4QM", "/administrasi"]) {
      expect(gateStaffRequest(path, visitor)).toEqual({ kind: "next" });
    }
  });
});

describe("signed-in staff", () => {
  it("open their own screens at the usual addresses", () => {
    expect(gateStaffRequest("/kasir/preorder", as("KASIR"))).toEqual({ kind: "next" });
    expect(gateStaffRequest("/dapur", as("DAPUR"))).toEqual({ kind: "next" });
    expect(gateStaffRequest("/admin/menu", as("ADMIN"))).toEqual({ kind: "next" });
    expect(gateStaffRequest("/akun", as("DAPUR"))).toEqual({ kind: "next" });
  });

  it("are shown the wrong-door page for another role's area, as before", () => {
    expect(gateStaffRequest("/admin", as("KASIR"))).toEqual({ kind: "redirect", to: "/403" });
    expect(gateStaffRequest("/kasir", as("DAPUR"))).toEqual({ kind: "redirect", to: "/403" });
  });
});

describe("without a secret address (development, tests)", () => {
  it("keeps the sign-in page at /login, and still hides the staff screens", () => {
    const plain = { role: undefined, loginPath: "/login" };
    expect(gateStaffRequest("/login", plain)).toEqual({ kind: "next" });
    expect(gateStaffRequest("/admin", plain)).toEqual({ kind: "not-found" });
  });
});

describe("staffLoginPath", () => {
  it("uses STAFF_LOGIN_PATH when it is a long single segment", () => {
    expect(staffLoginPath(SECRET)).toBe(SECRET);
    expect(staffLoginPath(`  ${SECRET} `)).toBe(SECRET);
  });

  it("falls back to /login when unset", () => {
    expect(staffLoginPath(undefined)).toBe("/login");
    expect(staffLoginPath("")).toBe("/login");
  });

  it("ignores, and reports, a value that is guessable or would clash with a real page", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const bad of ["/masuk", "masuk-k7f3q9x2m4wd", "/masuk/k7f3q9x2m4wd", "/Masuk-K7F3Q9X2M4WD", "/admin-k7f3q9x2m4wd/x", "/login"]) {
      expect(staffLoginPath(bad)).toBe("/login");
    }
    expect(log).toHaveBeenCalled();
  });
});

describe("isStaffPath", () => {
  it("matches whole segments only", () => {
    expect(isStaffPath("/admin")).toBe(true);
    expect(isStaffPath("/admin/menu")).toBe(true);
    expect(isStaffPath("/administrasi")).toBe(false);
    expect(isStaffPath("/kasirku")).toBe(false);
  });
});
