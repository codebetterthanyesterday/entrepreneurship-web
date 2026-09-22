import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BRAND_SLUG } from "@/lib/brand";

// There is no request scope, so no NextAuth session either. The signed-in user
// is whatever the test puts here; requireRole keeps its real role check.
const session = vi.hoisted(() => ({
  user: null as { id: string; name: string; role: string } | null,
}));

vi.mock("@/lib/session", async () => {
  const { ForbiddenError, UnauthorizedError } = await import("@/lib/errors");
  return {
    toActor: (user: { id: string; role: string }) => ({ id: user.id, role: user.role }),
    requireRole: async (...allowed: string[]) => {
      if (!session.user) throw new UnauthorizedError();
      if (!allowed.includes(session.user.role)) throw new ForbiddenError();
      return session.user;
    },
  };
});

const { GET } = await import("@/app/api/admin/export/route");
const { createOrder } = await import("@/lib/services/order.service");
const {
  closeDatabase,
  makeProduct,
  makeUser,
  resetDatabase,
} = await import("@/lib/services/__tests__/helpers/test-db");

async function signIn(role: "ADMIN" | "KASIR") {
  const user = await makeUser(role);
  session.user = { id: user.id, name: user.name, role };
  return user;
}

function request(type?: string): Request {
  const url = type
    ? `http://localhost/api/admin/export?type=${type}`
    : "http://localhost/api/admin/export";
  return new Request(url);
}

/** The body minus its BOM, split into records. */
async function records(response: Response): Promise<string[]> {
  const text = await response.text();
  return text.replace(/^\ufeff/, "").trimEnd().split("\r\n");
}

beforeEach(async () => {
  await resetDatabase();
  session.user = null;
});

afterAll(async () => {
  await closeDatabase();
});

describe("export access", () => {
  it("refuses an anonymous request", async () => {
    expect((await GET(request("orders"))).status).toBe(401);
  });

  it("refuses a cashier — this is every customer's phone number", async () => {
    await signIn("KASIR");

    expect((await GET(request("orders"))).status).toBe(403);
  });

  it("names the valid types when asked for one that does not exist", async () => {
    await signIn("ADMIN");

    const response = await GET(request("ngawur"));
    expect(response.status).toBe(400);

    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("orders, items, products");
  });

  it("refuses a request with no type at all", async () => {
    await signIn("ADMIN");

    expect((await GET(request())).status).toBe(400);
  });
});

describe("export delivery", () => {
  beforeEach(async () => {
    await signIn("ADMIN");
  });

  it.each([
    ["orders", "pesanan"],
    ["items", "rincian-item"],
    ["products", "rekap-menu"],
  ])("serves %s as a dated CSV attachment", async (type, filePrefix) => {
    const response = await GET(request(type));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toMatch(
      new RegExp(`attachment; filename="${BRAND_SLUG}-${filePrefix}-\\d{4}-\\d{2}-\\d{2}\\.csv"`),
    );
    // A cached export would quietly hand out an earlier snapshot of a moving
    // event.
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("starts the body with a BOM so Excel reads it as UTF-8", async () => {
    // Read as bytes, not as text: `Response.text()` runs the WHATWG UTF-8
    // decode, which strips a leading BOM — so a text assertion here would fail
    // even though the three bytes really are on the wire.
    const bytes = new Uint8Array(await (await GET(request("orders"))).arrayBuffer());

    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("serves headers alone when there is nothing to report", async () => {
    const lines = await records(await GET(request("orders")));

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Nomor Pesanan");
  });
});

describe("export contents", () => {
  beforeEach(async () => {
    await signIn("ADMIN");
  });

  it("writes enum columns in Indonesian, not as schema constants", async () => {
    // The reader is a lecturer with a spreadsheet; "IN_QUEUE" means nothing.
    const product = await makeProduct({ price: 10_000, stock: 20, prepType: "NEEDS_PREP" });
    await createOrder({
      channel: "ONSITE",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      customerName: "Pelanggan booth",
      items: [{ productId: product.id, quantity: 1 }],
    });

    const [, row] = await records(await GET(request("orders")));

    expect(row).toContain("Di tempat");
    expect(row).toContain("Antrian dapur");
    expect(row).toContain("Lunas");
    expect(row).not.toContain("ONSITE");
    expect(row).not.toContain("IN_QUEUE");
  });

  it("writes money as plain digits a spreadsheet can sum", async () => {
    const product = await makeProduct({ price: 20_500, stock: 20 });
    await createOrder({
      channel: "ONSITE",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      customerName: "Pelanggan booth",
      items: [{ productId: product.id, quantity: 2 }],
    });

    const [, row] = await records(await GET(request("orders")));

    expect(row).toContain("41000");
    expect(row).not.toContain("41.000");
    expect(row).not.toContain("Rp");
  });

  it("keeps a comma in a menu name from shifting the columns", async () => {
    const product = await makeProduct({ name: "Cimol, isi 10", price: 5_000, stock: 20 });
    await createOrder({
      channel: "ONSITE",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      customerName: "Pelanggan booth",
      items: [{ productId: product.id, quantity: 1 }],
    });

    const [header, row] = await records(await GET(request("items")));

    expect(row).toContain('"Cimol, isi 10"');
    // Same number of fields as the header, despite the comma in the name.
    const fields = row!.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.filter((f) => f !== "");
    expect(fields).toHaveLength(header!.split(",").length);
  });

  it("leaves a walk-in's blank phone and slot as empty cells, not 'null'", async () => {
    const product = await makeProduct({ stock: 20 });
    await createOrder({
      channel: "ONSITE",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      customerName: "Pelanggan booth",
      items: [{ productId: product.id, quantity: 1 }],
    });

    const [, row] = await records(await GET(request("orders")));

    expect(row).toContain(",,");
    expect(row).not.toContain("null");
  });

  it("recaps a menu that never sold rather than dropping it", async () => {
    await makeProduct({ name: "Batagor", price: 8_000, stock: 40 });

    const [, row] = await records(await GET(request("products")));

    expect(row).toContain("Batagor");
    expect(row).toContain("40");
  });
});
