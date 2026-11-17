import { describe, expect, it } from "vitest";
import { homeFor, rolePill, stripLabel, worldFor } from "@/lib/staff-chrome";

describe("the staff header's words", () => {
  it("names each role's seat in the pill", () => {
    expect(rolePill("ADMIN")).toBe("HQ · Admin");
    expect(rolePill("KASIR")).toBe("Counter · Kasir");
    expect(rolePill("DAPUR")).toBe("Kitchen · Dapur");
  });

  it("sends the brand to the role's own first screen", () => {
    expect(homeFor("ADMIN")).toBe("/admin");
    expect(homeFor("KASIR")).toBe("/kasir");
    expect(homeFor("DAPUR")).toBe("/dapur");
  });

  it("reads the world from the area, so an admin at the till is at the Counter Station", () => {
    expect(worldFor("ADMIN", "/kasir/preorder")).toBe("Counter Station");
    expect(stripLabel("ADMIN", "/dapur")).toBe("Kitchen Castle · Papan dapur");
  });

  it("puts Akun in the role's own world, since it belongs to no area", () => {
    expect(stripLabel("KASIR", "/akun")).toBe("Counter Station · Akun");
    expect(stripLabel("ADMIN", "/akun")).toBe("World HQ · Akun");
  });

  it("names every staff screen", () => {
    expect(stripLabel("ADMIN", "/admin/menu")).toBe("World HQ · Menu & stok");
    expect(stripLabel("ADMIN", "/admin/pengaturan")).toBe("World HQ · Pengaturan");
    expect(stripLabel("KASIR", "/kasir")).toBe("Counter Station · Pesanan baru");
  });
});
