import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, InsufficientStockError, InvalidTransitionError } from "@/lib/errors";
import {
  assertTransition,
  cancelOrder,
  createOrder,
  markAsPaid,
  mergeOrderLines,
  resolveInitialStatus,
  transitionStatus,
  type CreateOrderInput,
} from "@/lib/services/order.service";
import {
  closeDatabase,
  countOrderItems,
  countOrders,
  db,
  deleteStoreSettings,
  itemsOf,
  bookedIn,
  openPreorderWindow,
  makeProduct,
  makeUser,
  movementsFor,
  resetDatabase,
  setStoreOpen,
  stockOf,
} from "./helpers/test-db";
import { getSettings } from "@/lib/services/setting.service";

function onsiteOrder(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    channel: "ONSITE",
    items: [],
    customerName: "Pelanggan Uji",
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    ...overrides,
  };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("createOrder — happy path", () => {
  it("writes the order, decrements stock exactly, and snapshots the price", async () => {
    const product = await makeProduct({ price: 12_500, stock: 10 });

    const order = await createOrder(
      onsiteOrder({ items: [{ productId: product.id, quantity: 3 }] }),
    );

    expect(order.orderNumber).toMatch(/^OS-[23456789BCDFGHJKMNPQRSTVWXYZ]{6}$/);
    expect(order.totalAmount).toBe(37_500);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]!.priceAtOrder).toBe(12_500);
    expect(order.items[0]!.subtotal).toBe(37_500);
    expect(order.items[0]!.quantity).toBe(3);
    expect(await stockOf(product.id)).toBe(7);
  });

  it("keeps the snapshot price after the product price changes", async () => {
    const product = await makeProduct({ price: 10_000, stock: 5 });

    const order = await createOrder(
      onsiteOrder({ items: [{ productId: product.id, quantity: 1 }] }),
    );

    await db.orm.public.Product.where({ id: product.id }).update({ price: 25_000 });

    const reloaded = await db.orm.public.OrderItem.where({ orderId: order.id }).first();
    expect(reloaded!.priceAtOrder).toBe(10_000);
  });

  it("records one ORDER_CONFIRMED movement per item, linked to the order", async () => {
    const product = await makeProduct({ stock: 10 });

    const order = await createOrder(
      onsiteOrder({ items: [{ productId: product.id, quantity: 4 }] }),
    );

    const movements = await movementsFor(product.id);
    const confirmed = movements.filter((movement) => movement.reason === "ORDER_CONFIRMED");

    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]!.quantity).toBe(-4);
    expect(confirmed[0]!.orderId).toBe(order.id);
  });
});

describe("createOrder — insufficient stock", () => {
  it("rolls back the whole transaction and leaves stock untouched", async () => {
    const plenty = await makeProduct({ name: "Cukup", stock: 10 });
    const scarce = await makeProduct({ name: "Kurang", stock: 2 });

    await expect(
      createOrder(
        onsiteOrder({
          items: [
            { productId: plenty.id, quantity: 1 },
            { productId: scarce.id, quantity: 5 },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    expect(await countOrders()).toBe(0);
    expect(await countOrderItems()).toBe(0);
    expect(await stockOf(plenty.id)).toBe(10);
    expect(await stockOf(scarce.id)).toBe(2);
    expect(await movementsFor(plenty.id)).toHaveLength(0);
  });

  it("names the product that ran out, not its id", async () => {
    const product = await makeProduct({ name: "Croffle Butter Sugar", stock: 1 });

    await expect(
      createOrder(onsiteOrder({ items: [{ productId: product.id, quantity: 2 }] })),
    ).rejects.toThrow(/Croffle Butter Sugar/);
  });
});

describe("createOrder — concurrency", () => {
  it("sells the last unit exactly once", async () => {
    const product = await makeProduct({ name: "Terakhir", stock: 1 });
    const line = { productId: product.id, quantity: 1 };

    const results = await Promise.allSettled([
      createOrder(onsiteOrder({ items: [line] })),
      createOrder(onsiteOrder({ items: [line] })),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientStockError);

    expect(await stockOf(product.id)).toBe(0);
    expect(await countOrders()).toBe(1);
  });
});

describe("generateOrderNumber — uniqueness", () => {
  it("hands out 50 distinct numbers under concurrent creation", async () => {
    const product = await makeProduct({ stock: 100 });

    const orders = await Promise.all(
      Array.from({ length: 50 }, () =>
        createOrder(onsiteOrder({ items: [{ productId: product.id, quantity: 1 }] })),
      ),
    );

    const numbers = orders.map((order) => order.orderNumber);

    expect(numbers).toHaveLength(50);
    expect(new Set(numbers).size).toBe(50);
    expect(numbers.every((number) => /^OS-[23456789BCDFGHJKMNPQRSTVWXYZ]{6}$/.test(number))).toBe(true);
    expect(await stockOf(product.id)).toBe(50);
  });

  it("prefixes each channel's numbers with its own code", async () => {
    const product = await makeProduct({ stock: 10 });
    const schedule = await openPreorderWindow("09.00 - 10.00", 10);

    const onsite = await createOrder(
      onsiteOrder({ items: [{ productId: product.id, quantity: 1 }] }),
    );
    const preorder = await createOrder(
      onsiteOrder({
        channel: "PREORDER",
        paymentStatus: "UNPAID",
        customerPhone: "081234561234",
        schedule,
        items: [{ productId: product.id, quantity: 1 }],
      }),
    );

    expect(onsite.orderNumber).toMatch(/^OS-[23456789BCDFGHJKMNPQRSTVWXYZ]{6}$/);
    expect(preorder.orderNumber).toMatch(/^PO-[23456789BCDFGHJKMNPQRSTVWXYZ]{6}$/);
  });

  it("does not number orders in sequence, so one number says nothing about the next", async () => {
    const product = await makeProduct({ stock: 10 });

    const first = await createOrder(onsiteOrder({ items: [{ productId: product.id, quantity: 1 }] }));
    const second = await createOrder(onsiteOrder({ items: [{ productId: product.id, quantity: 1 }] }));

    expect(first.orderNumber).not.toBe("OS-0001");
    expect(second.orderNumber).not.toBe(first.orderNumber);
  });
});

describe("resolveInitialStatus", () => {
  it("is DONE when every item is ready to serve", async () => {
    const product = await makeProduct({ prepType: "READY_TO_SERVE", stock: 5 });

    const order = await createOrder(
      onsiteOrder({ items: [{ productId: product.id, quantity: 1 }] }),
    );

    expect(order.status).toBe("DONE");
    expect(order.completedAt).not.toBeNull();
    expect(order.queuedAt).toBeNull();
  });

  it("is IN_QUEUE when any item needs prep", async () => {
    const ready = await makeProduct({ prepType: "READY_TO_SERVE", stock: 5 });
    const racik = await makeProduct({ prepType: "NEEDS_PREP", stock: 5 });

    const order = await createOrder(
      onsiteOrder({
        items: [
          { productId: ready.id, quantity: 1 },
          { productId: racik.id, quantity: 1 },
        ],
      }),
    );

    expect(order.status).toBe("IN_QUEUE");
    expect(order.queuedAt).not.toBeNull();
  });

  it("is pure — no database needed", () => {
    const items = [{ productId: "a", quantity: 1 }];

    expect(
      resolveInitialStatus(items, [{ id: "a", prepType: "NEEDS_PREP" }]),
    ).toBe("IN_QUEUE");
    expect(
      resolveInitialStatus(items, [{ id: "a", prepType: "READY_TO_SERVE" }]),
    ).toBe("DONE");
  });
});

describe("assertTransition", () => {
  it("allows the edges in the table", () => {
    expect(() => assertTransition("CONFIRMED", "IN_QUEUE", "KASIR")).not.toThrow();
    expect(() => assertTransition("IN_QUEUE", "IN_PROGRESS", "DAPUR")).not.toThrow();
    expect(() => assertTransition("IN_PROGRESS", "READY", "DAPUR")).not.toThrow();
    expect(() => assertTransition("READY", "DONE", "KASIR")).not.toThrow();
    expect(() => assertTransition("READY", "DONE", "DAPUR")).not.toThrow();
    expect(() => assertTransition("READY", "IN_PROGRESS", "DAPUR")).not.toThrow();
    expect(() => assertTransition("CONFIRMED", "CANCELLED", "ADMIN")).not.toThrow();
  });

  it("rejects an edge that is not in the table", () => {
    expect(() => assertTransition("CONFIRMED", "READY", "KASIR")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("DONE", "IN_QUEUE", "KASIR")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("CANCELLED", "CONFIRMED", "ADMIN")).toThrow(
      InvalidTransitionError,
    );
    expect(() => assertTransition("READY", "CANCELLED", "ADMIN")).toThrow(InvalidTransitionError);
  });

  it("lets an admin walk every edge the till and the kitchen walk", () => {
    for (const [from, to] of [
      ["CONFIRMED", "IN_QUEUE"],
      ["CONFIRMED", "DONE"],
      ["IN_QUEUE", "IN_PROGRESS"],
      ["IN_PROGRESS", "READY"],
      ["IN_PROGRESS", "IN_QUEUE"],
      ["READY", "IN_PROGRESS"],
      ["READY", "DONE"],
    ] as const) {
      expect(() => assertTransition(from, to, "ADMIN")).not.toThrow();
    }
  });

  it("rejects a legal edge walked by the wrong role", () => {
    expect(() => assertTransition("IN_QUEUE", "IN_PROGRESS", "KASIR")).toThrow(ForbiddenError);
    expect(() => assertTransition("CONFIRMED", "IN_QUEUE", "DAPUR")).toThrow(ForbiddenError);
    expect(() => assertTransition("IN_QUEUE", "CANCELLED", "DAPUR")).toThrow(ForbiddenError);
  });
});

describe("cancelOrder", () => {
  it("puts the stock back exactly and records ORDER_CANCELLED", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ prepType: "NEEDS_PREP", stock: 8 });

    const order = await createOrder(
      onsiteOrder({ items: [{ productId: product.id, quantity: 3 }] }),
    );
    expect(await stockOf(product.id)).toBe(5);

    const cancelled = await cancelOrder(order.id, { id: kasir.id, role: "KASIR" }, "salah pesan");

    expect(cancelled.status).toBe("CANCELLED");
    expect(await stockOf(product.id)).toBe(8);

    const movements = await movementsFor(product.id);
    const returned = movements.filter((movement) => movement.reason === "ORDER_CANCELLED");

    expect(returned).toHaveLength(1);
    expect(returned[0]!.quantity).toBe(3);
    expect(returned[0]!.orderId).toBe(order.id);
    expect(cancelled.notes).toContain("salah pesan");
  });

  it("refuses a role that may not cancel", async () => {
    const dapur = await makeUser("DAPUR");
    const product = await makeProduct({ prepType: "NEEDS_PREP", stock: 5 });

    const order = await createOrder(
      onsiteOrder({ items: [{ productId: product.id, quantity: 1 }] }),
    );

    await expect(
      cancelOrder(order.id, { id: dapur.id, role: "DAPUR" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(await stockOf(product.id)).toBe(4);
  });
});

describe("createOrder — closed channels", () => {
  it("refuses a preorder while preorder is closed", async () => {
    const product = await makeProduct({ stock: 5 });
    const schedule = await openPreorderWindow("09.00 - 10.00", 10);
    await setStoreOpen({ preorderOpen: false });

    await expect(
      createOrder(
        onsiteOrder({
          channel: "PREORDER",
          paymentStatus: "UNPAID",
          customerPhone: "081234561234",
          schedule,
          items: [{ productId: product.id, quantity: 1 }],
        }),
      ),
    ).rejects.toThrow(/Preorder lagi ditutup/);

    expect(await countOrders()).toBe(0);
    expect(await stockOf(product.id)).toBe(5);
  });

  it("still allows an on-site order while preorder is closed", async () => {
    const product = await makeProduct({ stock: 5 });
    await setStoreOpen({ preorderOpen: false });

    const order = await createOrder(
      onsiteOrder({ items: [{ productId: product.id, quantity: 1 }] }),
    );

    expect(order.orderNumber).toMatch(/^OS-/);
  });

  it("refuses an on-site order while the booth is closed", async () => {
    const product = await makeProduct({ stock: 5 });
    await setStoreOpen({ boothOpen: false });

    await expect(
      createOrder(onsiteOrder({ items: [{ productId: product.id, quantity: 1 }] })),
    ).rejects.toThrow(/Booth lagi tutup/);
  });
});

describe("transitionStatus", () => {
  it("walks the kitchen path and stamps each timestamp", async () => {
    const dapur = await makeUser("DAPUR");
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ prepType: "NEEDS_PREP", stock: 5 });

    const order = await createOrder(
      onsiteOrder({ items: [{ productId: product.id, quantity: 1 }] }),
    );
    expect(order.status).toBe("IN_QUEUE");

    const started = await transitionStatus(order.id, "IN_PROGRESS", {
      id: dapur.id,
      role: "DAPUR",
    });
    expect(started.status).toBe("IN_PROGRESS");
    expect(started.startedAt).not.toBeNull();

    const ready = await transitionStatus(order.id, "READY", { id: dapur.id, role: "DAPUR" });
    expect(ready.status).toBe("READY");
    expect(ready.readyAt).not.toBeNull();

    const done = await transitionStatus(order.id, "DONE", { id: kasir.id, role: "KASIR" });
    expect(done.status).toBe("DONE");
    expect(done.completedAt).not.toBeNull();
  });

  it("refuses an illegal jump and leaves the status alone", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ prepType: "NEEDS_PREP", stock: 5 });

    const order = await createOrder(
      onsiteOrder({ items: [{ productId: product.id, quantity: 1 }] }),
    );

    await expect(
      transitionStatus(order.id, "DONE", { id: kasir.id, role: "KASIR" }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    const reloaded = await db.orm.public.Order.where({ id: order.id }).first();
    expect(reloaded!.status).toBe("IN_QUEUE");
  });

  it("refuses the right move by the wrong role", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ prepType: "NEEDS_PREP", stock: 5 });

    const order = await createOrder(
      onsiteOrder({ items: [{ productId: product.id, quantity: 1 }] }),
    );

    await expect(
      transitionStatus(order.id, "IN_PROGRESS", { id: kasir.id, role: "KASIR" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("markAsPaid", () => {
  it("marks the order paid and records who took the money", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ stock: 5, price: 10_000 });

    const order = await createOrder(
      onsiteOrder({ paymentStatus: "UNPAID", items: [{ productId: product.id, quantity: 1 }] }),
    );
    expect(order.paymentStatus).toBe("UNPAID");

    const paid = await markAsPaid(order.id, { id: kasir.id, role: "KASIR" }, 20_000);

    expect(paid.paymentStatus).toBe("PAID");
    expect(paid.cashReceived).toBe(20_000);
    expect(paid.handledById).toBe(kasir.id);
  });

  it("refuses an order that is already paid", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ stock: 5 });

    const order = await createOrder(
      onsiteOrder({ paymentStatus: "PAID", items: [{ productId: product.id, quantity: 1 }] }),
    );

    await expect(markAsPaid(order.id, { id: kasir.id, role: "KASIR" })).rejects.toThrow(
      /udah lunas/,
    );
  });

  it("refuses a cancelled order", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ prepType: "NEEDS_PREP", stock: 5 });

    const order = await createOrder(
      onsiteOrder({ paymentStatus: "UNPAID", items: [{ productId: product.id, quantity: 1 }] }),
    );
    await cancelOrder(order.id, { id: kasir.id, role: "KASIR" });

    await expect(markAsPaid(order.id, { id: kasir.id, role: "KASIR" })).rejects.toThrow(
      /udah dibatalin/,
    );
  });

  it("refuses a QRIS preorder until the customer's receipt is in, then takes it", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ stock: 5 });
    const schedule = await openPreorderWindow("09.00 - 10.00", 10);
    await getSettings();
    await db.orm.public.StoreSetting.where({ id: 1 }).update({
      qrisImageUrl: "/gambar/00000000-0000-4000-8000-000000000000",
    });
    const order = await createOrder(
      onsiteOrder({
        channel: "PREORDER",
        paymentStatus: "UNPAID",
        paymentMethod: "QRIS",
        customerPhone: "081234561234",
        schedule,
        items: [{ productId: product.id, quantity: 1 }],
      }),
    );

    await expect(markAsPaid(order.id, { id: kasir.id, role: "KASIR" })).rejects.toThrow(
      /Belum ada bukti bayar QRIS/,
    );

    await db.orm.public.Order.where({ id: order.id }).update({
      paymentProofUrl: "/gambar/00000000-0000-4000-8000-000000000001",
    });
    const paid = await markAsPaid(order.id, { id: kasir.id, role: "KASIR" });
    expect(paid.paymentStatus).toBe("PAID");
  });
});

describe("transitionStatus — a preorder is paid before it is made or handed over", () => {
  it("refuses to queue or hand over an unpaid preorder, and allows both once paid", async () => {
    const kasir = await makeUser("KASIR");
    const actor = { id: kasir.id, role: "KASIR" as const };
    const racik = await makeProduct({ prepType: "NEEDS_PREP", stock: 5 });
    const ready = await makeProduct({ prepType: "READY_TO_SERVE", stock: 5 });
    const schedule = await openPreorderWindow("09.00 - 10.00", 10);
    const preorder = (productId: string) =>
      createOrder(
        onsiteOrder({
          channel: "PREORDER",
          paymentStatus: "UNPAID",
          customerPhone: "081234561234",
          schedule,
          items: [{ productId, quantity: 1 }],
        }),
      );

    const withPrep = await preorder(racik.id);
    const readyOnly = await preorder(ready.id);

    await expect(transitionStatus(withPrep.id, "IN_QUEUE", actor)).rejects.toThrow(/belum lunas/);
    await expect(transitionStatus(readyOnly.id, "DONE", actor)).rejects.toThrow(/belum lunas/);
    expect((await db.orm.public.Order.where({ id: withPrep.id }).first())!.status).toBe("CONFIRMED");

    await markAsPaid(withPrep.id, actor);
    await markAsPaid(readyOnly.id, actor);
    expect((await transitionStatus(withPrep.id, "IN_QUEUE", actor)).status).toBe("IN_QUEUE");
    expect((await transitionStatus(readyOnly.id, "DONE", actor)).status).toBe("DONE");
  });

  it("still lets an unpaid preorder be cancelled", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ stock: 5 });
    const schedule = await openPreorderWindow("09.00 - 10.00", 10);
    const order = await createOrder(
      onsiteOrder({
        channel: "PREORDER",
        paymentStatus: "UNPAID",
        customerPhone: "081234561234",
        schedule,
        items: [{ productId: product.id, quantity: 1 }],
      }),
    );

    const cancelled = await cancelOrder(order.id, { id: kasir.id, role: "KASIR" }, "nggak jadi bayar");
    expect(cancelled.status).toBe("CANCELLED");
  });
});

describe("createOrder — inactive and missing products", () => {
  it("refuses a hidden menu", async () => {
    const product = await makeProduct({ name: "Disembunyikan", stock: 5, isActive: false });

    await expect(
      createOrder(onsiteOrder({ items: [{ productId: product.id, quantity: 1 }] })),
    ).rejects.toThrow(/lagi nggak dijual/);

    expect(await countOrders()).toBe(0);
  });

  it("refuses an unknown product id", async () => {
    await expect(
      createOrder(onsiteOrder({ items: [{ productId: "tidak-ada", quantity: 1 }] })),
    ).rejects.toThrow(/nggak ada di katalog/);
  });

  it("refuses an empty basket", async () => {
    await expect(createOrder(onsiteOrder({ items: [] }))).rejects.toThrow(/masih kosong/);
  });
});

describe("createOrder — preorder lifecycle", () => {
  it("starts a preorder at CONFIRMED whatever its items are", async () => {
    const ready = await makeProduct({ prepType: "READY_TO_SERVE", stock: 5 });
    const racik = await makeProduct({ prepType: "NEEDS_PREP", stock: 5 });
    const schedule = await openPreorderWindow("09.00 - 10.00", 10);

    const siapSaja = await createOrder(
      onsiteOrder({
        channel: "PREORDER",
        paymentStatus: "UNPAID",
        customerPhone: "081234561234",
        schedule,
        items: [{ productId: ready.id, quantity: 1 }],
      }),
    );
    const adaRacik = await createOrder(
      onsiteOrder({
        channel: "PREORDER",
        paymentStatus: "UNPAID",
        customerPhone: "081234561234",
        schedule,
        items: [{ productId: racik.id, quantity: 1 }],
      }),
    );

    expect(siapSaja.status).toBe("CONFIRMED");
    expect(adaRacik.status).toBe("CONFIRMED");
    expect(siapSaja.queuedAt).toBeNull();
    expect(siapSaja.completedAt).toBeNull();
  });

  it("lets the cashier move a confirmed preorder to where its items belong", async () => {
    const kasir = await makeUser("KASIR");
    const racik = await makeProduct({ prepType: "NEEDS_PREP", stock: 5 });
    const ready = await makeProduct({ prepType: "READY_TO_SERVE", stock: 5 });
    const schedule = await openPreorderWindow("09.00 - 10.00", 10);

    const preorder = (productId: string) =>
      createOrder(
        onsiteOrder({
          channel: "PREORDER",
          paymentStatus: "UNPAID",
          customerPhone: "081234561234",
          schedule,
          items: [{ productId, quantity: 1 }],
        }),
      );

    const withPrep = await preorder(racik.id);
    await markAsPaid(withPrep.id, { id: kasir.id, role: "KASIR" });
    const queued = await transitionStatus(withPrep.id, "IN_QUEUE", {
      id: kasir.id,
      role: "KASIR",
    });
    expect(queued.status).toBe("IN_QUEUE");
    expect(queued.queuedAt).not.toBeNull();

    const readyOnly = await preorder(ready.id);
    await markAsPaid(readyOnly.id, { id: kasir.id, role: "KASIR" });
    const handed = await transitionStatus(readyOnly.id, "DONE", { id: kasir.id, role: "KASIR" });
    expect(handed.status).toBe("DONE");
    expect(handed.completedAt).not.toBeNull();
  });

  it("can be cancelled from CONFIRMED, putting the stock back", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ stock: 6 });
    const schedule = await openPreorderWindow("09.00 - 10.00", 10);

    const order = await createOrder(
      onsiteOrder({
        channel: "PREORDER",
        paymentStatus: "UNPAID",
        customerPhone: "081234561234",
        schedule,
        items: [{ productId: product.id, quantity: 2 }],
      }),
    );
    expect(await stockOf(product.id)).toBe(4);

    const cancelled = await cancelOrder(order.id, { id: kasir.id, role: "KASIR" });

    expect(cancelled.status).toBe("CANCELLED");
    expect(await stockOf(product.id)).toBe(6);
  });
});

describe("createOrder — duplicate lines", () => {
  it("merges repeated lines for the same product into one item", async () => {
    const product = await makeProduct({ price: 5_000, stock: 20 });

    const order = await createOrder(
      onsiteOrder({
        items: [
          { productId: product.id, quantity: 2 },
          { productId: product.id, quantity: 3 },
        ],
      }),
    );

    const items = await itemsOf(order.id);

    expect(items).toHaveLength(1);
    expect(items[0]!.quantity).toBe(5);
    expect(items[0]!.subtotal).toBe(25_000);
    expect(order.totalAmount).toBe(25_000);
    expect(await stockOf(product.id)).toBe(15);
  });

  it("keeps distinct products apart while merging", async () => {
    const a = await makeProduct({ price: 1_000, stock: 20 });
    const b = await makeProduct({ price: 2_000, stock: 20 });

    const order = await createOrder(
      onsiteOrder({
        items: [
          { productId: a.id, quantity: 1 },
          { productId: b.id, quantity: 1 },
          { productId: a.id, quantity: 1 },
        ],
      }),
    );

    const items = await itemsOf(order.id);

    expect(items).toHaveLength(2);
    expect(order.totalAmount).toBe(4_000);
    expect(await stockOf(a.id)).toBe(18);
    expect(await stockOf(b.id)).toBe(19);
  });

  it("checks merged quantity against stock, not each line separately", async () => {
    const product = await makeProduct({ name: "Tinggal Tiga", stock: 3 });

    // Two lines of 2 are under stock individually but 4 together.
    await expect(
      createOrder(
        onsiteOrder({
          items: [
            { productId: product.id, quantity: 2 },
            { productId: product.id, quantity: 2 },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    expect(await stockOf(product.id)).toBe(3);
    expect(await countOrders()).toBe(0);
  });

  it("merges the pure helper's input", () => {
    expect(
      mergeOrderLines([
        { productId: "a", quantity: 1 },
        { productId: "b", quantity: 2 },
        { productId: "a", quantity: 4 },
      ]),
    ).toEqual([
      { productId: "a", quantity: 5 },
      { productId: "b", quantity: 2 },
    ]);
  });
});

describe("createOrder — missing settings fails closed", () => {
  it("refuses both channels when the settings row is absent", async () => {
    const product = await makeProduct({ stock: 5 });
    const schedule = await openPreorderWindow("09.00 - 10.00", 10);
    await deleteStoreSettings();

    await expect(
      createOrder(onsiteOrder({ items: [{ productId: product.id, quantity: 1 }] })),
    ).rejects.toThrow(/Booth lagi tutup/);

    await expect(
      createOrder(
        onsiteOrder({
          channel: "PREORDER",
          paymentStatus: "UNPAID",
          customerPhone: "081234561234",
          schedule,
          items: [{ productId: product.id, quantity: 1 }],
        }),
      ),
    ).rejects.toThrow(/Preorder lagi ditutup/);

    expect(await countOrders()).toBe(0);
    expect(await stockOf(product.id)).toBe(5);
  });
});

describe("a time range's booked counter", () => {
  const preorderIn = (
    schedule: CreateOrderInput["schedule"],
    productId: string,
  ): CreateOrderInput =>
    onsiteOrder({
      channel: "PREORDER",
      paymentStatus: "UNPAID",
      customerPhone: "081234561234",
      schedule,
      items: [{ productId, quantity: 1 }],
    });

  it("tracks the number of live orders in the range", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ stock: 50 });
    const schedule = await openPreorderWindow("09.00 - 10.00", 5);

    const first = await createOrder(preorderIn(schedule, product.id));
    await createOrder(preorderIn(schedule, product.id));

    expect(await bookedIn(schedule.serviceWindowId)).toBe(2);

    await cancelOrder(first.id, { id: kasir.id, role: "KASIR" });

    expect(await bookedIn(schedule.serviceWindowId)).toBe(1);
  });

  it("is not touched by a transaction that rolls back", async () => {
    const product = await makeProduct({ name: "Habis", stock: 0 });
    const schedule = await openPreorderWindow("09.00 - 10.00", 5);

    await expect(createOrder(preorderIn(schedule, product.id))).rejects.toBeInstanceOf(
      InsufficientStockError,
    );

    expect(await bookedIn(schedule.serviceWindowId)).toBe(0);
  });

  it("is not touched by on-site orders", async () => {
    const product = await makeProduct({ stock: 10 });
    const schedule = await openPreorderWindow("09.00 - 10.00", 5);

    await createOrder(onsiteOrder({ items: [{ productId: product.id, quantity: 1 }] }));

    expect(await bookedIn(schedule.serviceWindowId)).toBe(0);
  });

  it("refuses a preorder with no time range, which would reach no one", async () => {
    const product = await makeProduct({ stock: 10 });

    await expect(createOrder(preorderIn(null, product.id))).rejects.toThrow(/Pilih lokasi, tanggal, dan jamnya/);
    expect(await countOrders()).toBe(0);
    expect(await stockOf(product.id)).toBe(10);
  });
});

/**
 * Two staff screens open on the same order, acting at the same instant.
 *
 * The sequential case — one acts, the other presses a button its screen has not
 * refreshed yet — is caught by `assertTransition`, because the second request
 * reads the status the first one already wrote. These tests are about the case
 * `assertTransition` alone cannot catch: both requests read the status *before*
 * either has written, so both pass the table. Only the `status = from` test
 * inside the UPDATE can separate them.
 */
describe("transitionStatus — two screens acting at the same instant", () => {
  async function preorderWithPrep() {
    const product = await makeProduct({ price: 18_000, stock: 20, prepType: "NEEDS_PREP" });
    const schedule = await openPreorderWindow("09.00 - 10.00", 20);

    const order = await createOrder(
      onsiteOrder({
        channel: "PREORDER",
        paymentStatus: "UNPAID",
        schedule,
        items: [{ productId: product.id, quantity: 2 }],
      }),
    );

    return { order, product, windowId: schedule.serviceWindowId };
  }

  it("applies the same move once when both screens send it together", async () => {
    const kasir = await makeUser("KASIR");
    const { order } = await preorderWithPrep();
    const actor = { id: kasir.id, role: "KASIR" as const };
    await markAsPaid(order.id, actor);

    const results = await Promise.allSettled([
      transitionStatus(order.id, "IN_QUEUE", actor),
      transitionStatus(order.id, "IN_QUEUE", actor),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await db.orm.public.Order.where({ id: order.id }).first())!.status).toBe("IN_QUEUE");
  });

  it("hands stock back exactly once when two screens cancel together", async () => {
    // Run it a few times: which transaction commits first is down to timing,
    // and the guarantee has to hold either way.
    for (let attempt = 0; attempt < 3; attempt++) {
      await resetDatabase();
      const kasir = await makeUser("KASIR");
      const { order, product, windowId } = await preorderWithPrep();
      const actor = { id: kasir.id, role: "KASIR" as const };

      expect(await stockOf(product.id)).toBe(18);

      const results = await Promise.allSettled([
        cancelOrder(order.id, actor, "batal satu"),
        cancelOrder(order.id, actor, "batal dua"),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);

      // The units this order took come back once. Returning them twice would
      // leave the product holding more than it ever had.
      expect(await stockOf(product.id)).toBe(20);
      expect(await bookedIn(windowId)).toBe(0);
    }
  });

  it("never cancels and queues the same order at once", async () => {
    const kasir = await makeUser("KASIR");
    const { order, product, windowId } = await preorderWithPrep();
    const actor = { id: kasir.id, role: "KASIR" as const };

    const results = await Promise.allSettled([
      cancelOrder(order.id, actor, "berubah pikiran"),
      transitionStatus(order.id, "IN_QUEUE", actor),
    ]);

    // Exactly one of the two is applied. Letting both through used to leave the
    // order sitting in the kitchen queue with its stock already handed back and
    // its time range already released — two drinks made and given away that
    // the system believed had never been sold.
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);

    const final = (await db.orm.public.Order.where({ id: order.id }).first())!;
    const booked = await bookedIn(windowId);

    if (final.status === "CANCELLED") {
      expect(await stockOf(product.id)).toBe(20);
      expect(booked).toBe(0);
    } else {
      expect(final.status).toBe("IN_QUEUE");
      expect(await stockOf(product.id)).toBe(18);
      expect(booked).toBe(1);
    }
  });
});
