import { Temporal } from "@js-temporal/polyfill";
import postgres from "@prisma/orm-postgres/runtime";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Contract } from "../../../../../../../prisma/schema.d";
import contractJson from "../../../../../../../prisma/schema.json" with { type: "json" };
import contractExample from "@/app/api/internal/v1/__tests__/contract/charge.v1.json";

const SECRET = "s".repeat(32) + "-photobooth-test";

const { POST: postCharge } = await import("@/app/api/internal/v1/photobooth-charges/route");
const { POST: postVoid } = await import(
  "@/app/api/internal/v1/photobooth-charges/[externalId]/void/route"
);
const { createOrder, cancelOrder } = await import("@/lib/services/order.service");
const { closeDatabase, db, makePickupSlot, makeProduct, makeUser, resetDatabase } =
  await import("@/lib/services/__tests__/helpers/test-db");

type Body = { ok: boolean; data?: Record<string, unknown>; error?: string; field?: string };

const EXTERNAL_ID = contractExample.externalId;

function charge(payload: unknown, secret: string | null = SECRET) {
  return postCharge(
    new Request("http://localhost/api/internal/v1/photobooth-charges", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret === null ? {} : { authorization: `Bearer ${secret}` }),
      },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    }),
  );
}

function voidCharge(externalId: string, voidedAt: string, secret: string | null = SECRET) {
  return postVoid(
    new Request(`http://localhost/api/internal/v1/photobooth-charges/${externalId}/void`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret === null ? {} : { authorization: `Bearer ${secret}` }),
      },
      body: JSON.stringify({ voidedAt }),
    }),
    { params: Promise.resolve({ externalId }) },
  );
}

async function body(response: Response): Promise<Body> {
  return (await response.json()) as Body;
}

let kopi: { id: string };

async function preorder() {
  return await createOrder({
    channel: "PREORDER",
    items: [{ productId: kopi.id, quantity: 2 }],
    customerName: "Nadia Prameswari",
    customerPhone: "081234560042",
    pickupSlot: "09.00 - 10.00",
    paymentMethod: "CASH",
    paymentStatus: "UNPAID",
  });
}

/** The contract example, aimed at an order that exists in this test. */
function request(orderNumber: string, over: Record<string, unknown> = {}) {
  const { externalId, description, amount, paidAt } = contractExample;
  return { externalId, orderNumber, description, amount, paidAt, ...over };
}

async function chargeRows() {
  return await db.orm.public.ExternalCharge.all();
}

beforeAll(() => {
  process.env.PHOTOBOOTH_API_SECRETS = SECRET;
});

beforeEach(async () => {
  await resetDatabase();
  kopi = await makeProduct({ name: "Es Kopi Aren", stock: 100 });
  await makePickupSlot("09.00 - 10.00", 100);
});

afterAll(async () => {
  delete process.env.PHOTOBOOTH_API_SECRETS;
  await closeDatabase();
});

describe("authentication", () => {
  it("refuses both endpoints without the secret, and never caches", async () => {
    const order = await preorder();
    for (const response of [
      await charge(request(order.orderNumber), null),
      await charge(request(order.orderNumber), "wrong-secret-of-a-plausible-length-000"),
      await voidCharge(EXTERNAL_ID, "2026-12-05T08:00:00Z", null),
    ]) {
      expect(response.status).toBe(401);
      expect(await body(response)).toEqual({ ok: false, error: "unauthorized" });
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(await chargeRows()).toEqual([]);
  });
});

describe("POST /api/internal/v1/photobooth-charges", () => {
  it("records a paid charge on the preorder in the contract's shape, leaving its total alone", async () => {
    const order = await preorder();
    const response = await charge(request(order.orderNumber));

    expect(response.status).toBe(201);
    const { data } = await body(response);
    expect(data).toEqual({ ...contractExample, orderNumber: order.orderNumber });
    expect(Object.keys(data!).sort()).toEqual(Object.keys(contractExample).sort());

    const stored = await db.orm.public.Order.where({ id: order.id }).first();
    expect(stored?.totalAmount).toBe(order.totalAmount);
    const [row] = await chargeRows();
    expect(row).toMatchObject({ source: "PHOTOBOOTH", orderId: order.id, amount: 31000 });
  });

  it("sending the same charge again answers 200 and adds no second row", async () => {
    const order = await preorder();
    expect((await charge(request(order.orderNumber))).status).toBe(201);
    const again = await charge(request(order.orderNumber));
    expect(again.status).toBe(200);
    expect((await body(again)).data).toMatchObject({ externalId: EXTERNAL_ID });
    expect(await chargeRows()).toHaveLength(1);
  });

  it("a copy arriving while the first is still being written waits, then gets that charge", async () => {
    const order = await preorder();
    // A second connection plays the first request, caught halfway: it holds
    // the charge's lock and has written the row, but not committed yet. (The
    // test's own client runs one statement at a time, so two requests from it
    // could never overlap.)
    const other = postgres<Contract>({ contractJson, url: process.env.DATABASE_URL! });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let started!: () => void;
    const holding = new Promise<void>((resolve) => (started = resolve));
    const first = other.transaction(async (tx) => {
      await tx.execute(
        other.raw
          .sql`SELECT pg_advisory_xact_lock(hashtextextended(${`external_charge:${EXTERNAL_ID}`}, 0))`
          .affectedCount()
          .build(),
      );
      await tx.orm.public.ExternalCharge.create({
        source: "PHOTOBOOTH",
        externalId: EXTERNAL_ID,
        description: contractExample.description,
        amount: contractExample.amount,
        paidAt: Temporal.Instant.from(contractExample.paidAt),
        voidedAt: null,
        orderId: order.id,
      });
      started();
      await gate;
    });
    await holding;

    const second = charge(request(order.orderNumber));
    // Wait until the second request is blocked on that lock.
    for (let i = 0; ; i++) {
      const [row] = await db.runtime().query(
        db.raw
          .sql`SELECT count(*)::int AS "n" FROM pg_stat_activity WHERE "wait_event_type" = 'Lock' AND "datname" = current_database()`
          .returnsRow({ n: "pg/int4@1" })
          .build(),
      );
      if ((row?.n ?? 0) > 0) break;
      if (i > 200) throw new Error("The second request never waited");
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    release();
    await first;
    await other.close?.();

    const answer = await second;
    expect(answer.status).toBe(200);
    expect((await body(answer)).data).toMatchObject({ externalId: EXTERNAL_ID });
    expect(await chargeRows()).toHaveLength(1);
  });

  it("the same id with different content is a conflict", async () => {
    const order = await preorder();
    await charge(request(order.orderNumber));
    const response = await charge(request(order.orderNumber, { amount: 99000 }));
    expect(response.status).toBe(409);
    expect(await body(response)).toEqual({ ok: false, error: "conflict" });
    expect((await chargeRows())[0]?.amount).toBe(31000);
  });

  it("an unknown order number is not found", async () => {
    const response = await charge(request("PO-9999"));
    expect(response.status).toBe(404);
    expect(await body(response)).toEqual({ ok: false, error: "not_found" });
  });

  it("an on-the-spot order cannot take a charge", async () => {
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
    // Its OS- number is not a preorder number, so the request itself is refused.
    const response = await charge(request(onsite.orderNumber));
    expect(response.status).toBe(422);
    expect((await body(response)).field).toBe("orderNumber");
    expect(await chargeRows()).toEqual([]);
  });

  it("a cancelled preorder still takes the charge: the photobooth was paid", async () => {
    const order = await preorder();
    const cashier = await makeUser("KASIR");
    await cancelOrder(order.id, { id: cashier.id, role: "KASIR" });
    expect((await charge(request(order.orderNumber))).status).toBe(201);
  });

  it.each([
    ["amount", { amount: 0 }],
    ["amount", { amount: 1.5 }],
    ["description", { description: "" }],
    ["description", { description: "x".repeat(201) }],
    ["paidAt", { paidAt: "2026-12-05 07:12" }],
    ["externalId", { externalId: "not-a-uuid" }],
  ])("refuses a bad %s with 422 naming it", async (field, over) => {
    const order = await preorder();
    const response = await charge(request(order.orderNumber, over));
    expect(response.status).toBe(422);
    expect(await body(response)).toEqual({ ok: false, error: "invalid_request", field });
  });

  it("refuses a body that is not JSON", async () => {
    const response = await charge("{not json");
    expect(response.status).toBe(422);
    expect((await body(response)).error).toBe("invalid_request");
  });
});

describe("POST /api/internal/v1/photobooth-charges/{externalId}/void", () => {
  it("voids the charge and keeps it on record; voiding again changes nothing", async () => {
    const order = await preorder();
    await charge(request(order.orderNumber));

    const first = await voidCharge(EXTERNAL_ID, "2026-12-05T08:00:00Z");
    expect(first.status).toBe(200);
    expect((await body(first)).data).toMatchObject({
      externalId: EXTERNAL_ID,
      voidedAt: "2026-12-05T08:00:00Z",
    });

    const again = await voidCharge(EXTERNAL_ID, "2026-12-05T09:30:00Z");
    expect(again.status).toBe(200);
    expect((await body(again)).data).toMatchObject({ voidedAt: "2026-12-05T08:00:00Z" });
    expect(await chargeRows()).toHaveLength(1);
  });

  it("an unknown id is not found", async () => {
    expect(
      (await voidCharge("00000000-0000-4000-8000-000000000000", "2026-12-05T08:00:00Z"))
        .status,
    ).toBe(404);
    expect((await voidCharge("PO-0001", "2026-12-05T08:00:00Z")).status).toBe(404);
  });

  it("refuses a bad time with 422", async () => {
    const order = await preorder();
    await charge(request(order.orderNumber));
    const response = await voidCharge(EXTERNAL_ID, "kemarin");
    expect(response.status).toBe(422);
    expect((await body(response)).field).toBe("voidedAt");
  });
});
