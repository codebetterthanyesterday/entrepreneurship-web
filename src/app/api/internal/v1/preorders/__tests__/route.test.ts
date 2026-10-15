import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import contractExample from "@/app/api/internal/v1/__tests__/contract/preorder.v1.json";

const SECRET = "s".repeat(32) + "-photobooth-test";
const NEXT_SECRET = "n".repeat(32) + "-rotated-in";

const { GET: getOne } = await import("@/app/api/internal/v1/preorders/[orderNumber]/route");
const { GET: getFeed } = await import("@/app/api/internal/v1/preorders/route");
const { createOrder, cancelOrder } = await import("@/lib/services/order.service");
const { closeDatabase, db, makePickupSlot, makeProduct, makeUser, resetDatabase } =
  await import("@/lib/services/__tests__/helpers/test-db");

type Body = { ok: boolean; data?: unknown; error?: string; field?: string };

function authHeaders(secret: string | null): Record<string, string> {
  return secret === null ? {} : { authorization: `Bearer ${secret}` };
}

function one(orderNumber: string, secret: string | null = SECRET) {
  const headers = authHeaders(secret);
  return getOne(
    new Request(`http://localhost/api/internal/v1/preorders/${orderNumber}`, {
      headers,
    }),
    { params: Promise.resolve({ orderNumber }) },
  );
}

function feed(query = "", secret: string | null = SECRET) {
  const headers = authHeaders(secret);
  return getFeed(
    new Request(`http://localhost/api/internal/v1/preorders${query}`, {
      headers,
    }),
  );
}

async function body(response: Response): Promise<Body> {
  return (await response.json()) as Body;
}

let kopi: { id: string };
let croffle: { id: string };

async function preorder(name = "Nadia Prameswari", phone = "081234560042") {
  return await createOrder({
    channel: "PREORDER",
    items: [
      { productId: kopi.id, quantity: 1 },
      { productId: croffle.id, quantity: 2 },
    ],
    customerName: name,
    customerPhone: phone,
    pickupSlot: "09.00 - 10.00",
    paymentMethod: "CASH",
    paymentStatus: "UNPAID",
  });
}

/** Pins an order's updatedAt so the feed's order can be asserted. */
async function setUpdatedAt(orderNumber: string, iso: string) {
  await db.runtime().execute(
    db.raw.sql`
      UPDATE "public"."order" SET "updatedAt" = ${iso}::timestamptz
      WHERE "orderNumber" = ${orderNumber}
    `
      .affectedCount()
      .build(),
  );
}

beforeAll(() => {
  process.env.PHOTOBOOTH_API_SECRETS = `${SECRET}, ${NEXT_SECRET}`;
});

beforeEach(async () => {
  await resetDatabase();
  kopi = await makeProduct({ name: "Es Kopi Aren", stock: 100 });
  croffle = await makeProduct({ name: "Croffle Gula Aren", stock: 100 });
  await makePickupSlot("09.00 - 10.00", 100);
});

afterAll(async () => {
  delete process.env.PHOTOBOOTH_API_SECRETS;
  await closeDatabase();
});

describe("authentication", () => {
  it("refuses a request without a secret, with a wrong one, and with no secret configured", async () => {
    const order = await preorder();

    for (const response of [
      await one(order.orderNumber, null),
      await one(order.orderNumber, "wrong-secret-of-a-plausible-length-000"),
      await feed("", null),
    ]) {
      expect(response.status).toBe(401);
      expect(await body(response)).toEqual({
        ok: false,
        error: "unauthorized",
      });
    }

    const saved = process.env.PHOTOBOOTH_API_SECRETS;
    process.env.PHOTOBOOTH_API_SECRETS = "";
    try {
      expect((await one(order.orderNumber)).status).toBe(401);
    } finally {
      process.env.PHOTOBOOTH_API_SECRETS = saved;
    }
  });

  it("accepts every configured secret, so a secret can be rotated without downtime", async () => {
    const order = await preorder();

    expect((await one(order.orderNumber, SECRET)).status).toBe(200);
    expect((await one(order.orderNumber, NEXT_SECRET)).status).toBe(200);
  });

  it("ignores a configured secret shorter than 32 characters", async () => {
    const order = await preorder();
    const saved = process.env.PHOTOBOOTH_API_SECRETS;
    process.env.PHOTOBOOTH_API_SECRETS = "short";
    try {
      expect((await one(order.orderNumber, "short")).status).toBe(401);
    } finally {
      process.env.PHOTOBOOTH_API_SECRETS = saved;
    }
  });

  it("is never cached", async () => {
    const order = await preorder();
    for (const response of [
      await one(order.orderNumber),
      await feed(),
      await one("PO-9999", null),
    ]) {
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });
});

describe("GET /api/internal/v1/preorders/{orderNumber}", () => {
  it("returns exactly the contract's fields, with only the last four phone digits", async () => {
    const order = await preorder();

    const response = await one(order.orderNumber);
    const { data } = await body(response);

    expect(response.status).toBe(200);
    expect(Object.keys(data as object).sort()).toEqual(Object.keys(contractExample).sort());
    expect(data).toMatchObject({
      orderNumber: order.orderNumber,
      customerName: "Nadia Prameswari",
      phoneLast4: "0042",
      status: "CONFIRMED",
      paymentStatus: "UNPAID",
      pickupSlot: "09.00 - 10.00",
      items: [
        { name: "Es Kopi Aren", quantity: 1 },
        { name: "Croffle Gula Aren", quantity: 2 },
      ],
    });
    expect(JSON.stringify(data)).not.toContain("081234560042");
  });

  it("writes times as ISO 8601 in UTC", async () => {
    const order = await preorder();

    const data = (await body(await one(order.orderNumber))).data as Record<string, string>;

    for (const key of ["createdAt", "updatedAt"]) {
      expect(data[key]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    }
  });

  it("answers 404 for a number that does not exist", async () => {
    const response = await one("PO-9999");

    expect(response.status).toBe(404);
    expect(await body(response)).toEqual({ ok: false, error: "not_found" });
  });

  it("treats an on-the-spot order as if it did not exist", async () => {
    const cashier = await makeUser("KASIR");
    const onsite = await createOrder({
      channel: "ONSITE",
      items: [{ productId: kopi.id, quantity: 1 }],
      customerName: "Pembeli booth",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      cashReceived: 20_000,
      handledById: cashier.id,
    });

    // The pattern already refuses OS- numbers; the query refuses them too.
    expect((await one(onsite.orderNumber)).status).toBe(400);
    expect(onsite.orderNumber).toMatch(/^OS-/);
  });

  it("still returns a cancelled preorder, so the photobooth can react to it", async () => {
    const order = await preorder();
    const cashier = await makeUser("KASIR");
    await cancelOrder(order.id, { id: cashier.id, role: "KASIR" });

    const { data } = await body(await one(order.orderNumber));

    expect(data).toMatchObject({ status: "CANCELLED" });
  });

  it.each(["po-0001", "PO-1", "OS-0001", "PO-0001;drop", "%20"])(
    "refuses the malformed number %s",
    async (orderNumber) => {
      const response = await one(orderNumber);

      expect(response.status).toBe(400);
      expect(await body(response)).toEqual({
        ok: false,
        error: "invalid_request",
        field: "orderNumber",
      });
    },
  );
});

describe("GET /api/internal/v1/preorders (change feed)", () => {
  async function threeOrders() {
    const a = await preorder("Nadia");
    const b = await preorder("Bagas", "081200009002");
    const c = await preorder("Laras", "081200009003");
    await setUpdatedAt(a.orderNumber, "2026-12-05T07:00:00Z");
    await setUpdatedAt(b.orderNumber, "2026-12-05T07:00:00Z");
    await setUpdatedAt(c.orderNumber, "2026-12-05T08:00:00Z");
    return [a, b, c].map((order) => order.orderNumber);
  }

  it("lists preorders oldest change first, ties broken by order number", async () => {
    const numbers = await threeOrders();

    const { data } = await body(await feed());
    const items = (data as { items: { orderNumber: string }[] }).items;

    expect(items.map((item) => item.orderNumber)).toEqual(numbers);
    expect((data as { nextCursor: unknown }).nextCursor).toBeNull();
  });

  it("pages through the feed without skipping or repeating, even across a tie", async () => {
    const numbers = await threeOrders();
    const seen: string[] = [];

    let query = "?limit=1";
    for (let page = 0; page < 5; page++) {
      const { data } = await body(await feed(query));
      const { items, nextCursor } = data as {
        items: { orderNumber: string }[];
        nextCursor: string | null;
      };
      seen.push(...items.map((item) => item.orderNumber));
      if (!nextCursor) break;
      query = `?limit=1&cursor=${encodeURIComponent(nextCursor)}`;
    }

    expect(seen).toEqual(numbers);
  });

  it("returns only what changed at or after updatedSince", async () => {
    const numbers = await threeOrders();

    const { data } = await body(await feed("?updatedSince=2026-12-05T08:00:00Z"));
    const items = (data as { items: { orderNumber: string }[] }).items;

    expect(items.map((item) => item.orderNumber)).toEqual([numbers[2]]);
  });

  it("accepts updatedSince with a time-zone offset", async () => {
    const numbers = await threeOrders();

    const { data } = await body(await feed("?updatedSince=2026-12-05T15:00:00%2B07:00"));
    const items = (data as { items: { orderNumber: string }[] }).items;

    expect(items.map((item) => item.orderNumber)).toEqual([numbers[2]]);
  });

  it("never includes on-the-spot orders", async () => {
    await preorder();
    const cashier = await makeUser("KASIR");
    await createOrder({
      channel: "ONSITE",
      items: [{ productId: kopi.id, quantity: 1 }],
      customerName: "Pembeli booth",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      cashReceived: 20_000,
      handledById: cashier.id,
    });

    const { data } = await body(await feed());
    const items = (data as { items: { orderNumber: string }[] }).items;

    expect(items).toHaveLength(1);
    expect(items[0]!.orderNumber).toMatch(/^PO-/);
  });

  it.each([
    ["?limit=0", "limit"],
    ["?limit=501", "limit"],
    ["?limit=abc", "limit"],
    ["?updatedSince=kemarin", "updatedSince"],
    ["?updatedSince=2026-12-05", "updatedSince"],
    ["?cursor=bukan-kursor", "cursor"],
  ])("refuses %s", async (query, field) => {
    const response = await feed(query);

    expect(response.status).toBe(400);
    expect(await body(response)).toEqual({
      ok: false,
      error: "invalid_request",
      field,
    });
  });
});
