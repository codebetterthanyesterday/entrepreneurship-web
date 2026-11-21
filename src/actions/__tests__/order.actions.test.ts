import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// revalidatePath needs a request scope that does not exist in a test process.
// The action's caching behaviour is not what these tests are about.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
// A server action reads the caller's address for its rate limits; the test is
// one caller, at one address.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.7" }),
}));

// There is no request, so no NextAuth session either. The signed-in user is
// whatever the test puts here; requireRole keeps its real role check.
const session = vi.hoisted(() => ({
  user: null as { id: string; name: string; role: string } | null,
}));

vi.mock("@/lib/session", async () => {
  const { ForbiddenError, UnauthorizedError } = await import("@/lib/errors");
  return {
    requireRole: async (...allowed: string[]) => {
      if (!session.user) throw new UnauthorizedError();
      if (!allowed.includes(session.user.role)) throw new ForbiddenError();
      return session.user;
    },
  };
});

const { submitOnsiteOrderAction, submitPreorderAction } = await import("@/actions/order.actions");
const {
  closeDatabase,
  countOrders,
  db,
  makeBundle,
  makeProduct,
  makeUser,
  resetDatabase,
  setStoreOpen,
  stockOf,
} = await import("@/lib/services/__tests__/helpers/test-db");

const { openServiceDay } = await import("@/lib/services/schedule.service");
const { Temporal } = await import("@js-temporal/polyfill");
const { todayInJakarta } = await import("@/lib/schedule");

// Far enough ahead to be bookable whatever the cut-off, inside the checkout horizon.
const DATE = Temporal.PlainDate.from(todayInJakarta()).add({ days: 10 }).toString();
const RANGE = "09.00 - 10.00";
let windowId = "";

/** Opens DATE for Kampus B with one 09.00 - 10.00 range of `quota` places. */
async function openWindow(quota: number) {
  const day = await openServiceDay({
    date: DATE,
    locations: ["CAMPUS_B", "MARKET_DAY"],
    windows: [{ startMinute: 540, endMinute: 600, quota }],
  });
  const window = await db.orm.public.ServiceWindow.where({ dayId: day.id }).first();
  windowId = window!.id;
}

async function bookedOn(id: string) {
  return (await db.orm.public.ServiceWindow.where({ id }).first())!.booked;
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Pelanggan Uji",
    customerPhone: "081234567890",
    handoverLocation: "CAMPUS_B",
    serviceWindowId: windowId,
    paymentMethod: "QRIS",
    ...overrides,
  };
}

async function orderByNumber(orderNumber: string) {
  const order = await db.orm.public.Order.where({ orderNumber })
    .include("items", (item) => item.include("product"))
    .first();
  if (!order) throw new Error(`Order ${orderNumber} not found`);
  return order;
}

beforeEach(async () => {
  await resetDatabase();
  // Preorders are paid by QRIS only, so checkout needs a QRIS to show.
  await db.orm.public.StoreSetting.where({ id: 1 }).update({
    qrisImageUrl: "/gambar/00000000-0000-4000-8000-000000000000",
  });
  session.user = null;
});

afterAll(async () => {
  await closeDatabase();
});

describe("submitPreorderAction — what it refuses to trust", () => {
  it("ignores paymentStatus, channel, prices and handler sent by the client", async () => {
    const product = await makeProduct({ name: "Lemonade", price: 19_000, stock: 10 });
    await openWindow(20);

    const result = await submitPreorderAction(
      payload({
        // Everything below is the attack: a hand-crafted POST claiming the
        // order is already paid, rung up at the booth, and costs one rupiah.
        paymentStatus: "PAID",
        channel: "ONSITE",
        status: "DONE",
        totalAmount: 1,
        handledById: "penyerang",
        items: [{ productId: product.id, quantity: 2, priceAtOrder: 1, price: 1, subtotal: 1 }],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await orderByNumber(result.data.orderNumber);

    expect(order.paymentStatus).toBe("UNPAID");
    expect(order.channel).toBe("PREORDER");
    expect(order.status).toBe("CONFIRMED");
    expect(order.handledById).toBeNull();
    expect(order.totalAmount).toBe(38_000);
    expect(order.items[0]!.priceAtOrder).toBe(19_000);
    expect(order.items[0]!.subtotal).toBe(38_000);
  });

  it("prices from the product row even when the price changes mid-session", async () => {
    const product = await makeProduct({ price: 10_000, stock: 10 });
    await openWindow(20);

    await db.orm.public.Product.where({ id: product.id }).update({ price: 12_000 });

    const result = await submitPreorderAction(
      payload({ items: [{ productId: product.id, quantity: 1 }] }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await orderByNumber(result.data.orderNumber);
    expect(order.totalAmount).toBe(12_000);
  });

  it("numbers the order as a preorder", async () => {
    const product = await makeProduct({ stock: 10 });
    await openWindow(20);

    const result = await submitPreorderAction(
      payload({ items: [{ productId: product.id, quantity: 1 }] }),
    );

    expect(result.ok && result.data.orderNumber).toMatch(/^PO-[23456789BCDFGHJKMNPQRSTVWXYZ]{6}$/);
  });

  it("records where, which day and which range, taking the range's label from the server", async () => {
    const product = await makeProduct({ stock: 10 });
    await openWindow(20);

    const result = await submitPreorderAction(
      payload({
        items: [{ productId: product.id, quantity: 1 }],
        handoverDetail: "Depan gazebo",
        pickupSlot: "23.00 - 24.00",
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await orderByNumber(result.data.orderNumber);
    expect(order.serviceDate).toBe(DATE);
    expect(order.pickupSlot).toBe(RANGE);
    expect(order.handoverLocation).toBe("CAMPUS_B");
    expect(order.handoverDetail).toBe("Depan gazebo");
    expect(order.serviceWindowId).toBe(windowId);
    expect(await bookedOn(windowId)).toBe(1);
  });
});

describe("submitPreorderAction — validation", () => {
  const cases: Array<[string, Record<string, unknown>, string, string]> = [
    ["a name that is too short", { customerName: "A" }, "customerName", "Isi nama dulu ya"],
    ["a phone that is not 0-prefixed", { customerPhone: "6281234" }, "customerPhone", "Nomor WhatsApp-nya belum betul"],
    ["a phone that is too short", { customerPhone: "0812345" }, "customerPhone", "Nomor WhatsApp-nya belum betul"],
    ["a missing time range", { serviceWindowId: "" }, "serviceWindowId", "Pilih tanggal dan jamnya dulu ya"],
    ["a missing location", { handoverLocation: undefined }, "handoverLocation", "Pilih lokasi serah terimanya dulu ya"],
    ["a Lainnya without its detail", { handoverLocation: "OTHER", handoverDetail: "kos" }, "handoverDetail", "Tulis lokasinya lengkap ya, biar kami bisa cek jangkauannya"],
    ["an unknown payment method", { paymentMethod: "GRATIS" }, "paymentMethod", "Preorder dibayar lewat QRIS ya"],
    ["cash, which a preorder no longer takes", { paymentMethod: "CASH" }, "paymentMethod", "Preorder dibayar lewat QRIS ya"],
  ];

  it.each(cases)("rejects %s", async (_label, overrides, field, message) => {
    const product = await makeProduct({ stock: 10 });
    await openWindow(20);

    const result = await submitPreorderAction(
      payload({ items: [{ productId: product.id, quantity: 1 }], ...overrides }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.field).toBe(field);
    expect(result.error).toBe(message);
    expect(await countOrders()).toBe(0);
  });

  it("rejects an empty basket", async () => {
    await openWindow(20);

    const result = await submitPreorderAction(payload({ items: [] }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("items");
  });

  it("rejects a note longer than 200 characters", async () => {
    const product = await makeProduct({ stock: 10 });
    await openWindow(20);

    const result = await submitPreorderAction(
      payload({ notes: "x".repeat(201), items: [{ productId: product.id, quantity: 1 }] }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("notes");
  });

  it("accepts a note of exactly 200 characters", async () => {
    const product = await makeProduct({ stock: 10 });
    await openWindow(20);

    const result = await submitPreorderAction(
      payload({ notes: "x".repeat(200), items: [{ productId: product.id, quantity: 1 }] }),
    );

    expect(result.ok).toBe(true);
  });
});

describe("submitPreorderAction — rate limits", () => {
  it("refuses a sixth preorder for one WhatsApp number within the hour, before taking any stock", async () => {
    const product = await makeProduct({ stock: 50 });
    await openWindow(50);
    const order = () => submitPreorderAction(payload({ items: [{ productId: product.id, quantity: 1 }] }));

    for (let i = 0; i < 5; i++) expect((await order()).ok).toBe(true);
    const sixth = await order();

    expect(sixth.ok).toBe(false);
    if (sixth.ok) return;
    expect(sixth.field).toBe("customerPhone");
    expect(sixth.error).toMatch(/kebanyakan pesan/);
    expect(await countOrders()).toBe(5);
    expect(await stockOf(product.id)).toBe(45);
  });

  it("still takes an order for another number from the same place", async () => {
    const product = await makeProduct({ stock: 50 });
    await openWindow(50);
    for (let i = 0; i < 5; i++) {
      await submitPreorderAction(payload({ items: [{ productId: product.id, quantity: 1 }] }));
    }

    const other = await submitPreorderAction(
      payload({ customerPhone: "081298765432", items: [{ productId: product.id, quantity: 1 }] }),
    );

    expect(other.ok).toBe(true);
  });
});

describe("submitPreorderAction — failures the customer can act on", () => {
  it("names the product that ran out", async () => {
    const product = await makeProduct({ name: "Croffle Butter Sugar", stock: 2 });
    await openWindow(20);

    const result = await submitPreorderAction(
      payload({ items: [{ productId: product.id, quantity: 5 }] }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toContain("Croffle Butter Sugar");
    expect(result.field).toBe("items");
    expect(await stockOf(product.id)).toBe(2);
    expect(await countOrders()).toBe(0);
  });

  it("refuses when the preorder channel is closed, however the request was made", async () => {
    const product = await makeProduct({ stock: 10 });
    await openWindow(20);
    await setStoreOpen({ preorderOpen: false });

    const result = await submitPreorderAction(
      payload({ items: [{ productId: product.id, quantity: 1 }] }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toMatch(/Preorder lagi ditutup/);
    expect(await countOrders()).toBe(0);
    expect(await stockOf(product.id)).toBe(10);
  });

  it("refuses while there is no QRIS to pay with, and leaves stock alone", async () => {
    const product = await makeProduct({ stock: 10 });
    await openWindow(20);
    await db.orm.public.StoreSetting.where({ id: 1 }).update({ qrisImageUrl: null });

    const result = await submitPreorderAction(
      payload({ items: [{ productId: product.id, quantity: 1 }] }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toMatch(/Pembayaran QRIS lagi disiapin/);
    expect(await countOrders()).toBe(0);
    expect(await stockOf(product.id)).toBe(10);
  });

  it("refuses a full time range and leaves stock alone", async () => {
    const product = await makeProduct({ stock: 50 });
    await openWindow(1);

    const first = await submitPreorderAction(
      payload({ items: [{ productId: product.id, quantity: 1 }] }),
    );
    expect(first.ok).toBe(true);

    const second = await submitPreorderAction(
      payload({ items: [{ productId: product.id, quantity: 1 }] }),
    );

    expect(second.ok).toBe(false);
    if (second.ok) return;

    expect(second.error).toMatch(/udah penuh/);
    expect(second.field).toBe("serviceWindowId");
    expect(await countOrders()).toBe(1);
    expect(await stockOf(product.id)).toBe(49);
    expect(await bookedOn(windowId)).toBe(1);
  });

  it("does not leak a database error to the customer", async () => {
    const result = await submitPreorderAction("bukan objek");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).not.toMatch(/prisma|sql|postgres/i);
  });
});

describe("submitPreorderAction — double submit", () => {
  it("creates two orders if the client really does send twice", async () => {
    // The UI disables the button while a request is in flight, and the action
    // itself is not idempotent — this pins down what actually happens so the
    // guarantee is understood to live in the client, not here.
    const product = await makeProduct({ stock: 10 });
    await openWindow(20);

    const body = payload({ items: [{ productId: product.id, quantity: 1 }] });
    const [first, second] = await Promise.all([
      submitPreorderAction(body),
      submitPreorderAction(body),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(await countOrders()).toBe(2);

    // Whatever else happens, the two never share a number.
    if (first.ok && second.ok) {
      expect(first.data.orderNumber).not.toBe(second.data.orderNumber);
    }
  });
});

// ---------------------------------------------------------------------------
// On-the-spot
// ---------------------------------------------------------------------------

async function signInAs(role: "KASIR" | "ADMIN" | "DAPUR") {
  const user = await makeUser(role);
  session.user = { id: user.id, name: user.name, role };
  return user;
}

describe("submitOnsiteOrderAction — who may ring up a sale", () => {
  it("refuses without a session and writes nothing", async () => {
    const product = await makeProduct({ stock: 10 });

    const result = await submitOnsiteOrderAction({
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: "QRIS",
    });

    expect(result.ok).toBe(false);
    expect(await countOrders()).toBe(0);
    expect(await stockOf(product.id)).toBe(10);
  });

  it("refuses the kitchen role", async () => {
    await signInAs("DAPUR");
    const product = await makeProduct({ stock: 10 });

    const result = await submitOnsiteOrderAction({
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: "QRIS",
    });

    expect(result.ok).toBe(false);
    expect(await countOrders()).toBe(0);
  });

  it("lets an admin ring up a sale", async () => {
    await signInAs("ADMIN");
    const product = await makeProduct({ stock: 10 });

    const result = await submitOnsiteOrderAction({
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: "QRIS",
    });

    expect(result.ok).toBe(true);
  });
});

describe("submitOnsiteOrderAction — what it refuses to trust", () => {
  it("sets channel, payment status, handler and prices on the server", async () => {
    const kasir = await signInAs("KASIR");
    const product = await makeProduct({ price: 15_000, stock: 10 });

    const result = await submitOnsiteOrderAction({
      paymentMethod: "CASH",
      cashReceived: 50_000,
      // The attack: a hand-shaped request pretending to be a preorder, unpaid,
      // handled by somebody else, and costing one rupiah.
      channel: "PREORDER",
      paymentStatus: "UNPAID",
      handledById: "penyerang",
      totalAmount: 1,
      items: [{ productId: product.id, quantity: 2, priceAtOrder: 1, subtotal: 1 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await orderByNumber(result.data.orderNumber);

    expect(order.channel).toBe("ONSITE");
    expect(order.paymentStatus).toBe("PAID");
    expect(order.handledById).toBe(kasir.id);
    expect(order.totalAmount).toBe(30_000);
    expect(order.items[0]!.priceAtOrder).toBe(15_000);
    expect(order.cashReceived).toBe(50_000);
    expect(result.data.orderNumber).toMatch(/^OS-[23456789BCDFGHJKMNPQRSTVWXYZ]{6}$/);
    expect(result.data.change).toBe(20_000);
  });

  it("refuses cash that does not cover the server's total, even if the till was fooled", async () => {
    await signInAs("KASIR");
    const product = await makeProduct({ price: 10_000, stock: 10 });

    // The till last saw 10.000; the admin has since raised the price.
    await db.orm.public.Product.where({ id: product.id }).update({ price: 12_000 });

    const result = await submitOnsiteOrderAction({
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: "CASH",
      cashReceived: 10_000,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.field).toBe("cashReceived");
    expect(result.error).toMatch(/kurang Rp2\.000/);
    expect(await countOrders()).toBe(0);
    expect(await stockOf(product.id)).toBe(10);
  });

  it("accepts exact cash", async () => {
    await signInAs("KASIR");
    const product = await makeProduct({ price: 12_500, stock: 10 });

    const result = await submitOnsiteOrderAction({
      items: [{ productId: product.id, quantity: 2 }],
      paymentMethod: "CASH",
      cashReceived: 25_000,
    });

    expect(result.ok && result.data.change).toBe(0);
  });

  it("requires a cash amount for a cash sale", async () => {
    await signInAs("KASIR");
    const product = await makeProduct({ stock: 10 });

    const result = await submitOnsiteOrderAction({
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: "CASH",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("cashReceived");
    expect(await countOrders()).toBe(0);
  });

  it("drops a cash amount sent with a QRIS sale", async () => {
    await signInAs("KASIR");
    const product = await makeProduct({ stock: 10 });

    const result = await submitOnsiteOrderAction({
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: "QRIS",
      cashReceived: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await orderByNumber(result.data.orderNumber);
    expect(order.cashReceived).toBeNull();
    expect(result.data.change).toBeNull();
  });
});

describe("submitOnsiteOrderAction — where the order goes", () => {
  it("sends a basket with a made-to-order item to the kitchen", async () => {
    await signInAs("KASIR");
    const croffle = await makeProduct({ prepType: "NEEDS_PREP", stock: 10 });
    const bottle = await makeProduct({ prepType: "READY_TO_SERVE", stock: 10 });

    const result = await submitOnsiteOrderAction({
      items: [
        { productId: croffle.id, quantity: 2 },
        { productId: bottle.id, quantity: 1 },
      ],
      paymentMethod: "QRIS",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.status).toBe("IN_QUEUE");
    expect(result.data.prepItemCount).toBe(2);
    expect(await stockOf(croffle.id)).toBe(8);
    expect(await stockOf(bottle.id)).toBe(9);
  });

  it("sells a paket at the booth, taking each product's stock", async () => {
    await signInAs("KASIR");
    const croffle = await makeProduct({ prepType: "NEEDS_PREP", price: 20_000, stock: 10 });
    const kopi = await makeProduct({ prepType: "READY_TO_SERVE", price: 18_000, stock: 10 });
    const combo = await makeBundle({
      price: 32_000,
      items: [
        { productId: croffle.id, quantity: 1 },
        { productId: kopi.id, quantity: 1 },
      ],
    });

    const result = await submitOnsiteOrderAction({
      items: [],
      bundles: [{ bundleId: combo.id, quantity: 2 }],
      paymentMethod: "CASH",
      cashReceived: 70_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.totalAmount).toBe(64_000);
    expect(result.data.change).toBe(6_000);
    expect(result.data.status).toBe("IN_QUEUE");
    expect(await stockOf(croffle.id)).toBe(8);
    expect(await stockOf(kopi.id)).toBe(8);
  });

  it("refuses an empty bill even when the bundle list is present but empty", async () => {
    await signInAs("KASIR");

    const result = await submitOnsiteOrderAction({
      items: [],
      bundles: [],
      paymentMethod: "QRIS",
    });

    expect(result.ok).toBe(false);
  });

  it("hands a ready-only basket over immediately", async () => {
    await signInAs("KASIR");
    const bottle = await makeProduct({ prepType: "READY_TO_SERVE", stock: 10 });

    const result = await submitOnsiteOrderAction({
      items: [{ productId: bottle.id, quantity: 3 }],
      paymentMethod: "QRIS",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.status).toBe("DONE");
    expect(result.data.prepItemCount).toBe(0);
  });

  it("names the product that ran out and leaves stock alone", async () => {
    await signInAs("KASIR");
    const product = await makeProduct({ name: "Es Kopi Susu", stock: 1 });

    const result = await submitOnsiteOrderAction({
      items: [{ productId: product.id, quantity: 2 }],
      paymentMethod: "QRIS",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toContain("Es Kopi Susu");
    expect(await stockOf(product.id)).toBe(1);
    expect(await countOrders()).toBe(0);
  });

  it("refuses when the booth is closed", async () => {
    await signInAs("KASIR");
    const product = await makeProduct({ stock: 10 });
    await setStoreOpen({ boothOpen: false });

    const result = await submitOnsiteOrderAction({
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: "QRIS",
    });

    expect(result.ok).toBe(false);
    expect(await countOrders()).toBe(0);
  });
});
