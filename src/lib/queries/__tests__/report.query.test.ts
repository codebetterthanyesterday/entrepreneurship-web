import { Temporal } from "@js-temporal/polyfill";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  PIPELINE_STATUSES,
  getAllOrders,
  getChannelBreakdown,
  getHourlySales,
  getOrderPipeline,
  getSalesSummary,
  getTodayRevenue,
  getTopProducts,
} from "@/lib/queries/report.query";
import {
  cancelOrder,
  createOrder,
  markAsPaid,
  transitionStatus,
} from "@/lib/services/order.service";
import type { OrderLineInput } from "@/lib/services/order.service";
import type { OrderChannel, PaymentStatus } from "@/types/order";
import {
  closeDatabase,
  db,
  makePickupSlot,
  makeProduct,
  makeUser,
  resetDatabase,
} from "@/lib/services/__tests__/helpers/test-db";

const JAKARTA = "Asia/Jakarta";

async function sell(price: number, paid: boolean) {
  const product = await makeProduct({ price, stock: 50, prepType: "READY_TO_SERVE" });

  const order = await createOrder({
    channel: "ONSITE",
    paymentStatus: paid ? "PAID" : "UNPAID",
    paymentMethod: "CASH",
    customerName: "Pelanggan booth",
    items: [{ productId: product.id, quantity: 1 }],
  });

  return order;
}

/** Places an order on a given channel, with full control over its lines. */
async function place(options: {
  channel: OrderChannel;
  paymentStatus: PaymentStatus;
  items: readonly OrderLineInput[];
  pickupSlot?: string;
}) {
  return await createOrder({
    channel: options.channel,
    paymentStatus: options.paymentStatus,
    paymentMethod: "CASH",
    customerName: options.channel === "PREORDER" ? "Rani" : "Pelanggan booth",
    ...(options.channel === "PREORDER"
      ? { customerPhone: "081234567890", pickupSlot: options.pickupSlot ?? "09.00 - 10.00" }
      : {}),
    items: options.items,
  });
}

/** Moves an order's `createdAt`, which is otherwise always "now". */
async function backdate(orderId: string, at: Temporal.Instant): Promise<void> {
  await db.runtime().execute(
    db.raw
      .sql`UPDATE "public"."order" SET "createdAt" = ${at.toString()}::timestamptz WHERE "id" = ${orderId}`
      .affectedCount()
      .build(),
  );
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("getTodayRevenue", () => {
  it("is zero with no orders", async () => {
    expect(await getTodayRevenue()).toBe(0);
  });

  it("sums only the paid orders", async () => {
    await sell(20_000, true);
    await sell(15_000, true);
    await sell(99_000, false);

    expect(await getTodayRevenue()).toBe(35_000);
  });

  it("counts an order once the cashier takes payment", async () => {
    const kasir = await makeUser("KASIR");
    const order = await sell(12_000, false);

    expect(await getTodayRevenue()).toBe(0);

    await markAsPaid(order.id, { id: kasir.id, role: "KASIR" });

    expect(await getTodayRevenue()).toBe(12_000);
  });

  it("drops an order that was paid and then voided", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ price: 30_000, stock: 10, prepType: "NEEDS_PREP" });

    const order = await createOrder({
      channel: "ONSITE",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      customerName: "Pelanggan booth",
      items: [{ productId: product.id, quantity: 1 }],
    });
    expect(await getTodayRevenue()).toBe(30_000);

    // Money handed back is not money taken.
    await cancelOrder(order.id, { id: kasir.id, role: "KASIR" });
    expect(await getTodayRevenue()).toBe(0);
  });

  it("ignores orders from another day", async () => {
    const order = await sell(25_000, true);
    expect(await getTodayRevenue()).toBe(25_000);

    // Backdate it by one day in the event's timezone.
    const yesterday = Temporal.Now.zonedDateTimeISO(JAKARTA).subtract({ days: 1 }).toInstant();
    await backdate(order.id, yesterday);

    expect(await getTodayRevenue()).toBe(0);
  });

  it("counts an order placed just after midnight in Jakarta, not UTC", async () => {
    // 00:30 Jakarta is 17:30 UTC the previous day. A UTC-based day boundary
    // would miss this sale; the event runs on Jakarta time.
    const justAfterMidnight = Temporal.Now.zonedDateTimeISO(JAKARTA)
      .startOfDay()
      .add({ minutes: 30 });

    const order = await sell(18_000, true);
    await backdate(order.id, justAfterMidnight.toInstant());

    expect(await getTodayRevenue()).toBe(18_000);
  });
});

describe("countUnfinishedPreorders", () => {
  it("counts everything the cashier still has to deal with", async () => {
    const { countUnfinishedPreorders } = await import("@/lib/queries/order.query");

    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ stock: 50, prepType: "READY_TO_SERVE" });
    await makePickupSlot("09.00 - 10.00", 20);

    const preorder = () =>
      createOrder({
        channel: "PREORDER",
        paymentStatus: "UNPAID",
        paymentMethod: "CASH",
        customerName: "Rani",
        pickupSlot: "09.00 - 10.00",
        items: [{ productId: product.id, quantity: 1 }],
      });

    const first = await preorder();
    await preorder();
    expect(await countUnfinishedPreorders()).toBe(2);

    // An on-site sale is not a preorder and must not be counted.
    await createOrder({
      channel: "ONSITE",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      customerName: "Pelanggan booth",
      items: [{ productId: product.id, quantity: 1 }],
    });
    expect(await countUnfinishedPreorders()).toBe(2);

    await cancelOrder(first.id, { id: kasir.id, role: "KASIR" });
    expect(await countUnfinishedPreorders()).toBe(1);
  });
});

describe("getSalesSummary", () => {
  it("reads all zeros on an empty database", async () => {
    expect(await getSalesSummary()).toEqual({
      totalRevenue: 0,
      orderCount: 0,
      portionCount: 0,
      remainingStock: 0,
      activeProductCount: 0,
      averageOrderValue: 0,
      lowStockCount: 0,
    });
  });

  it("counts money from paid orders but portions from every live order", async () => {
    const product = await makeProduct({ price: 10_000, stock: 100 });

    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 3 }] });
    await place({ channel: "ONSITE", paymentStatus: "UNPAID", items: [{ productId: product.id, quantity: 2 }] });

    const summary = await getSalesSummary();

    // Only the paid order is money; both are orders, and both took stock.
    expect(summary.totalRevenue).toBe(30_000);
    expect(summary.orderCount).toBe(2);
    expect(summary.portionCount).toBe(5);
    expect(summary.remainingStock).toBe(95);
  });

  it("leaves a cancelled order out of the money, the count and the portions", async () => {
    const kasir = await makeUser("KASIR");
    // Made to order, so the sale waits in the kitchen queue — a ready-to-serve
    // one is handed over and DONE the moment it is rung up, and DONE is final.
    const product = await makeProduct({ price: 10_000, stock: 100, prepType: "NEEDS_PREP" });

    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 1 }] });
    const voided = await place({
      channel: "ONSITE",
      paymentStatus: "PAID",
      items: [{ productId: product.id, quantity: 4 }],
    });

    await cancelOrder(voided.id, { id: kasir.id, role: "KASIR" });

    const summary = await getSalesSummary();

    expect(summary.totalRevenue).toBe(10_000);
    expect(summary.orderCount).toBe(1);
    expect(summary.portionCount).toBe(1);
    // Cancelling gave the four portions back to the shelf.
    expect(summary.remainingStock).toBe(99);
  });

  it("averages revenue over the order count the dashboard shows beside it", async () => {
    const product = await makeProduct({ price: 15_000, stock: 100 });

    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 1 }] });
    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 2 }] });

    const summary = await getSalesSummary();

    expect(summary.totalRevenue).toBe(45_000);
    expect(summary.orderCount).toBe(2);
    // The card's subtext must be the quotient of the two cards above it.
    expect(summary.averageOrderValue).toBe(Math.round(45_000 / 2));
  });

  it("ignores inactive products when totalling what is left on the shelf", async () => {
    await makeProduct({ stock: 20, isActive: true });
    await makeProduct({ stock: 500, isActive: false });

    const summary = await getSalesSummary();

    expect(summary.remainingStock).toBe(20);
    // The withdrawn menu is not one the booth can sell today either.
    expect(summary.activeProductCount).toBe(1);
  });

  it("counts low stock against the configured threshold", async () => {
    await makeProduct({ stock: 0 });
    await makeProduct({ stock: 3 });
    await makeProduct({ stock: 4 });
    // Nearly empty, but withdrawn from the menu — nobody needs to refill it.
    await makeProduct({ stock: 1, isActive: false });

    expect((await getSalesSummary()).lowStockCount).toBe(2);

    await db.orm.public.StoreSetting.where({ id: 1 }).update({ lowStockThreshold: 5 });

    expect((await getSalesSummary()).lowStockCount).toBe(3);
  });
});

describe("getChannelBreakdown", () => {
  beforeEach(async () => {
    await makePickupSlot("09.00 - 10.00", 20);
  });

  it("reads zero on both channels with nothing sold", async () => {
    expect(await getChannelBreakdown()).toEqual({
      preorder: { revenue: 0, orderCount: 0 },
      onsite: { revenue: 0, orderCount: 0 },
      preorderPercentage: 0,
    });
  });

  it("splits revenue and orders between the two channels", async () => {
    const product = await makeProduct({ price: 10_000, stock: 100 });

    await place({ channel: "PREORDER", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 3 }] });
    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 1 }] });

    const breakdown = await getChannelBreakdown();

    expect(breakdown.preorder).toEqual({ revenue: 30_000, orderCount: 1 });
    expect(breakdown.onsite).toEqual({ revenue: 10_000, orderCount: 1 });
    expect(breakdown.preorderPercentage).toBe(75);
  });

  it("keeps an unpaid preorder out of the revenue but counts the order", async () => {
    const product = await makeProduct({ price: 10_000, stock: 100 });

    await place({ channel: "PREORDER", paymentStatus: "UNPAID", items: [{ productId: product.id, quantity: 2 }] });
    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 1 }] });

    const breakdown = await getChannelBreakdown();

    expect(breakdown.preorder).toEqual({ revenue: 0, orderCount: 1 });
    expect(breakdown.onsite).toEqual({ revenue: 10_000, orderCount: 1 });
    expect(breakdown.preorderPercentage).toBe(0);
  });

  it("gives a whole percentage, so the two halves of the bar add to 100", async () => {
    const product = await makeProduct({ price: 10_000, stock: 100 });

    // 2 : 1 — a third that does not divide evenly.
    await place({ channel: "PREORDER", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 2 }] });
    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 1 }] });

    const { preorderPercentage } = await getChannelBreakdown();

    expect(preorderPercentage).toBe(67);
    expect(Number.isInteger(preorderPercentage)).toBe(true);
    expect(100 - preorderPercentage).toBe(33);
  });

  it("agrees with the summary's total revenue", async () => {
    const product = await makeProduct({ price: 12_500, stock: 100 });

    await place({ channel: "PREORDER", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 2 }] });
    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 3 }] });

    const [summary, breakdown] = await Promise.all([getSalesSummary(), getChannelBreakdown()]);

    expect(breakdown.preorder.revenue + breakdown.onsite.revenue).toBe(summary.totalRevenue);
    expect(breakdown.preorder.orderCount + breakdown.onsite.orderCount).toBe(summary.orderCount);
  });
});

describe("getTopProducts", () => {
  it("is empty with nothing sold", async () => {
    expect(await getTopProducts()).toEqual([]);
  });

  it("ranks by portions sold, not by revenue", async () => {
    const cheap = await makeProduct({ name: "Cimol", price: 5_000, stock: 100 });
    const pricey = await makeProduct({ name: "Rice Bowl", price: 25_000, stock: 100 });

    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: cheap.id, quantity: 10 }] });
    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: pricey.id, quantity: 3 }] });

    const top = await getTopProducts();

    expect(top.map((row) => row.name)).toEqual(["Cimol", "Rice Bowl"]);
    expect(top[0]).toEqual({
      productId: cheap.id,
      name: "Cimol",
      imageUrl: null,
      quantitySold: 10,
      revenue: 50_000,
    });
    // Ranked second despite bringing in more money.
    expect(top[1]?.revenue).toBe(75_000);
  });

  it("honours the limit", async () => {
    for (let index = 0; index < 7; index += 1) {
      const product = await makeProduct({ name: `Menu ${index}`, price: 1_000, stock: 100 });
      await place({
        channel: "ONSITE",
        paymentStatus: "PAID",
        items: [{ productId: product.id, quantity: index + 1 }],
      });
    }

    expect(await getTopProducts()).toHaveLength(5);
    expect(await getTopProducts(3)).toHaveLength(3);
  });

  it("prices each line at priceAtOrder, so repricing the menu never rewrites the report", async () => {
    const product = await makeProduct({ name: "Es Teh", price: 5_000, stock: 100 });

    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 4 }] });

    expect((await getTopProducts())[0]?.revenue).toBe(20_000);

    // The menu price doubles after the sale. The money in the tin did not.
    await db.orm.public.Product.where({ id: product.id }).update({ price: 10_000 });

    expect((await getTopProducts())[0]?.revenue).toBe(20_000);
  });

  it("counts unsold-but-ordered portions while leaving their money out", async () => {
    await makePickupSlot("09.00 - 10.00", 20);
    const product = await makeProduct({ name: "Risoles", price: 8_000, stock: 100 });

    await place({ channel: "PREORDER", paymentStatus: "UNPAID", items: [{ productId: product.id, quantity: 6 }] });

    expect(await getTopProducts()).toEqual([
      { productId: product.id, name: "Risoles", imageUrl: null, quantitySold: 6, revenue: 0 },
    ]);
  });

  it("drops a cancelled order's lines entirely", async () => {
    const kasir = await makeUser("KASIR");
    const kept = await makeProduct({ name: "Seblak", price: 10_000, stock: 100 });
    // Made to order: it waits in the kitchen queue, so it can still be voided.
    const voided = await makeProduct({
      name: "Batagor",
      price: 10_000,
      stock: 100,
      prepType: "NEEDS_PREP",
    });

    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: kept.id, quantity: 1 }] });
    const order = await place({
      channel: "ONSITE",
      paymentStatus: "PAID",
      items: [{ productId: voided.id, quantity: 9 }],
    });

    await cancelOrder(order.id, { id: kasir.id, role: "KASIR" });

    expect(await getTopProducts()).toEqual([
      { productId: kept.id, name: "Seblak", imageUrl: null, quantitySold: 1, revenue: 10_000 },
    ]);
  });
});

describe("getHourlySales", () => {
  it("is empty with no orders", async () => {
    expect(await getHourlySales()).toEqual([]);
  });

  it("buckets orders by the hour they came in, in Jakarta time", async () => {
    const product = await makeProduct({ price: 10_000, stock: 100 });
    const today = Temporal.Now.zonedDateTimeISO(JAKARTA).startOfDay();

    const nine = await place({
      channel: "ONSITE",
      paymentStatus: "PAID",
      items: [{ productId: product.id, quantity: 1 }],
    });
    const alsoNine = await place({
      channel: "ONSITE",
      paymentStatus: "PAID",
      items: [{ productId: product.id, quantity: 2 }],
    });
    const eleven = await place({
      channel: "ONSITE",
      paymentStatus: "PAID",
      items: [{ productId: product.id, quantity: 1 }],
    });

    await backdate(nine.id, today.add({ hours: 9, minutes: 5 }).toInstant());
    await backdate(alsoNine.id, today.add({ hours: 9, minutes: 55 }).toInstant());
    await backdate(eleven.id, today.add({ hours: 11 }).toInstant());

    expect(await getHourlySales()).toEqual([
      { hour: 9, revenue: 30_000, orderCount: 2 },
      { hour: 11, revenue: 10_000, orderCount: 1 },
    ]);
  });

  it("reads the hour in Jakarta rather than UTC", async () => {
    const product = await makeProduct({ price: 10_000, stock: 100 });
    const today = Temporal.Now.zonedDateTimeISO(JAKARTA).startOfDay();

    const order = await place({
      channel: "ONSITE",
      paymentStatus: "PAID",
      items: [{ productId: product.id, quantity: 1 }],
    });

    // 11:00 in Jakarta is 04:00 UTC. Bucketing in UTC would file the lunch
    // rush under four in the morning.
    await backdate(order.id, today.add({ hours: 11 }).toInstant());

    const hourly = await getHourlySales();

    expect(hourly).toHaveLength(1);
    expect(hourly[0]?.hour).toBe(11);
  });

  it("shows an hour whose orders are all still unpaid", async () => {
    await makePickupSlot("09.00 - 10.00", 20);
    const product = await makeProduct({ price: 10_000, stock: 100 });
    const today = Temporal.Now.zonedDateTimeISO(JAKARTA).startOfDay();

    const order = await place({
      channel: "PREORDER",
      paymentStatus: "UNPAID",
      items: [{ productId: product.id, quantity: 1 }],
    });
    await backdate(order.id, today.add({ hours: 8 }).toInstant());

    expect(await getHourlySales()).toEqual([{ hour: 8, revenue: 0, orderCount: 1 }]);
  });

  it("leaves cancelled orders out of the graph", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ price: 10_000, stock: 100, prepType: "NEEDS_PREP" });
    const today = Temporal.Now.zonedDateTimeISO(JAKARTA).startOfDay();

    const order = await place({
      channel: "ONSITE",
      paymentStatus: "PAID",
      items: [{ productId: product.id, quantity: 1 }],
    });
    await backdate(order.id, today.add({ hours: 10 }).toInstant());

    await cancelOrder(order.id, { id: kasir.id, role: "KASIR" });

    expect(await getHourlySales()).toEqual([]);
  });
});

describe("getOrderPipeline", () => {
  it("reads zero at every stage rather than dropping the empty ones", async () => {
    const pipeline = await getOrderPipeline();

    expect(Object.keys(pipeline).sort()).toEqual([...PIPELINE_STATUSES].sort());
    expect(Object.values(pipeline).every((count) => count === 0)).toBe(true);
  });

  it("counts orders at the stage they are actually sitting at", async () => {
    const kasir = await makeUser("KASIR");
    const dapur = await makeUser("DAPUR");
    await makePickupSlot("09.00 - 10.00", 20);

    const readyToServe = await makeProduct({ price: 5_000, stock: 100, prepType: "READY_TO_SERVE" });
    const needsPrep = await makeProduct({ price: 5_000, stock: 100, prepType: "NEEDS_PREP" });

    // A preorder waiting to be collected.
    await place({ channel: "PREORDER", paymentStatus: "UNPAID", items: [{ productId: readyToServe.id, quantity: 1 }] });

    // An over-the-counter sale that needed no kitchen work.
    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: readyToServe.id, quantity: 1 }] });

    // Two that went to the kitchen; one of them has been started.
    const queued = await place({
      channel: "ONSITE",
      paymentStatus: "PAID",
      items: [{ productId: needsPrep.id, quantity: 1 }],
    });
    const started = await place({
      channel: "ONSITE",
      paymentStatus: "PAID",
      items: [{ productId: needsPrep.id, quantity: 1 }],
    });
    await transitionStatus(started.id, "IN_PROGRESS", { id: dapur.id, role: "DAPUR" });

    expect(await getOrderPipeline()).toEqual({
      CONFIRMED: 1,
      IN_QUEUE: 1,
      IN_PROGRESS: 1,
      READY: 0,
      DONE: 1,
    });

    // Cancelling one takes it out of the pipeline altogether.
    await cancelOrder(queued.id, { id: kasir.id, role: "KASIR" });

    expect(await getOrderPipeline()).toEqual({
      CONFIRMED: 1,
      IN_QUEUE: 0,
      IN_PROGRESS: 1,
      READY: 0,
      DONE: 1,
    });
  });
});

describe("getAllOrders", () => {
  beforeEach(async () => {
    await makePickupSlot("09.00 - 10.00", 50);
  });

  it("reads an empty first page with no orders", async () => {
    const page = await getAllOrders();

    expect(page).toEqual({
      orders: [],
      total: 0,
      totalAmount: 0,
      page: 1,
      pageSize: 50,
      pageCount: 1,
    });
  });

  it("returns orders newest first, with their lines and products", async () => {
    const product = await makeProduct({ name: "Cireng", price: 7_000, stock: 100 });

    const first = await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 1 }] });
    const second = await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 2 }] });

    const today = Temporal.Now.zonedDateTimeISO(JAKARTA).startOfDay();
    await backdate(first.id, today.add({ hours: 9 }).toInstant());
    await backdate(second.id, today.add({ hours: 10 }).toInstant());

    const page = await getAllOrders();

    expect(page.total).toBe(2);
    expect(page.orders.map((order) => order.id)).toEqual([second.id, first.id]);
    expect(page.orders[0]?.items[0]?.product.name).toBe("Cireng");
    expect(page.orders[0]?.items[0]?.priceAtOrder).toBe(7_000);
  });

  it("keeps cancelled orders in the list, because the list is the audit trail", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ stock: 100, prepType: "NEEDS_PREP" });

    const order = await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 1 }] });
    await cancelOrder(order.id, { id: kasir.id, role: "KASIR" });

    const page = await getAllOrders();

    expect(page.total).toBe(1);
    expect(page.orders[0]?.status).toBe("CANCELLED");
  });

  it("filters by channel, payment status and a set of statuses", async () => {
    const product = await makeProduct({ stock: 100, prepType: "READY_TO_SERVE" });

    await place({ channel: "PREORDER", paymentStatus: "UNPAID", items: [{ productId: product.id, quantity: 1 }] });
    await place({ channel: "PREORDER", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 1 }] });
    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 1 }] });

    expect((await getAllOrders({ channel: "PREORDER" })).total).toBe(2);
    expect((await getAllOrders({ channel: "ONSITE" })).total).toBe(1);
    expect((await getAllOrders({ paymentStatus: "UNPAID" })).total).toBe(1);

    // A preorder sits at CONFIRMED; an over-the-counter sale is DONE already.
    expect((await getAllOrders({ status: "CONFIRMED" })).total).toBe(2);
    expect((await getAllOrders({ status: ["CONFIRMED", "IN_QUEUE"] })).total).toBe(2);
    expect((await getAllOrders({ status: ["DONE"] })).total).toBe(1);
  });

  it("combines filters rather than replacing them", async () => {
    const product = await makeProduct({ stock: 100 });

    await place({ channel: "PREORDER", paymentStatus: "UNPAID", items: [{ productId: product.id, quantity: 1 }] });
    await place({ channel: "PREORDER", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 1 }] });

    const page = await getAllOrders({ channel: "PREORDER", paymentStatus: "UNPAID" });

    expect(page.total).toBe(1);
    expect(page.orders[0]?.paymentStatus).toBe("UNPAID");
  });

  it("paginates without repeating or losing a row", async () => {
    const product = await makeProduct({ stock: 100 });
    const today = Temporal.Now.zonedDateTimeISO(JAKARTA).startOfDay();

    for (let index = 0; index < 7; index += 1) {
      const order = await place({
        channel: "ONSITE",
        paymentStatus: "PAID",
        items: [{ productId: product.id, quantity: 1 }],
      });
      await backdate(order.id, today.add({ hours: 9, minutes: index }).toInstant());
    }

    const first = await getAllOrders({ page: 1, pageSize: 3 });
    const second = await getAllOrders({ page: 2, pageSize: 3 });
    const third = await getAllOrders({ page: 3, pageSize: 3 });

    expect(first.pageCount).toBe(3);
    expect(first.total).toBe(7);
    expect([first, second, third].map((page) => page.orders.length)).toEqual([3, 3, 1]);

    const seen = [...first.orders, ...second.orders, ...third.orders].map((order) => order.id);
    expect(new Set(seen).size).toBe(7);
  });

  it("clamps a page number past the end onto the last page with rows on it", async () => {
    const product = await makeProduct({ stock: 100 });
    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 1 }] });

    const page = await getAllOrders({ page: 99, pageSize: 10 });

    expect(page.page).toBe(1);
    expect(page.orders).toHaveLength(1);
  });

  it("names the member of staff who handled the order, without their credentials", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ stock: 100 });

    const order = await place({ channel: "PREORDER", paymentStatus: "UNPAID", items: [{ productId: product.id, quantity: 1 }] });
    await markAsPaid(order.id, { id: kasir.id, role: "KASIR" });

    const page = await getAllOrders();
    const handledBy = page.orders[0]?.handledBy;

    expect(handledBy?.name).toBe(kasir.name);
    expect(handledBy).not.toHaveProperty("password");
  });

  it("leaves handledBy null on an order nobody has touched", async () => {
    const product = await makeProduct({ stock: 100 });
    await place({ channel: "PREORDER", paymentStatus: "UNPAID", items: [{ productId: product.id, quantity: 1 }] });

    expect((await getAllOrders()).orders[0]?.handledBy).toBeNull();
  });
});

describe("getAllOrders totals", () => {
  beforeEach(async () => {
    await makePickupSlot("09.00 - 10.00", 50);
  });

  it("values the filtered orders whether or not they have been paid", async () => {
    // The "Belum bayar" chip has to tell the admin how much is still out there
    // to collect, so this figure is the face value of the listed orders — not
    // takings, which the dashboard reports separately.
    const product = await makeProduct({ price: 10_000, stock: 100 });

    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 2 }] });
    await place({ channel: "PREORDER", paymentStatus: "UNPAID", items: [{ productId: product.id, quantity: 3 }] });

    expect((await getAllOrders()).totalAmount).toBe(50_000);
    expect((await getAllOrders({ paymentStatus: "UNPAID" })).totalAmount).toBe(30_000);
  });

  it("counts a cancelled order in the list but not in its value", async () => {
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ price: 10_000, stock: 100, prepType: "NEEDS_PREP" });

    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 1 }] });
    const voided = await place({
      channel: "ONSITE",
      paymentStatus: "PAID",
      items: [{ productId: product.id, quantity: 5 }],
    });
    await cancelOrder(voided.id, { id: kasir.id, role: "KASIR" });

    const page = await getAllOrders();

    // Still listed — the list is the audit trail — but worth nothing.
    expect(page.total).toBe(2);
    expect(page.totalAmount).toBe(10_000);
  });

  it("is zero when the filter matches nothing", async () => {
    const page = await getAllOrders({ channel: "PREORDER" });

    expect(page.total).toBe(0);
    expect(page.totalAmount).toBe(0);
  });
});

describe("export queries", () => {
  beforeEach(async () => {
    await makePickupSlot("09.00 - 10.00", 50);
  });

  it("lists every order oldest first, cancellations included", async () => {
    const { getOrdersForExport } = await import("@/lib/queries/report.query");
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ price: 9_000, stock: 100, prepType: "NEEDS_PREP" });
    const today = Temporal.Now.zonedDateTimeISO(JAKARTA).startOfDay();

    const first = await place({
      channel: "ONSITE",
      paymentStatus: "PAID",
      items: [{ productId: product.id, quantity: 1 }],
    });
    const second = await place({
      channel: "ONSITE",
      paymentStatus: "PAID",
      items: [{ productId: product.id, quantity: 2 }],
    });
    await backdate(first.id, today.add({ hours: 9 }).toInstant());
    await backdate(second.id, today.add({ hours: 10 }).toInstant());
    await cancelOrder(second.id, { id: kasir.id, role: "KASIR" });

    const rows = await getOrdersForExport();

    expect(rows.map((row) => row.orderNumber)).toEqual([first.orderNumber, second.orderNumber]);
    // The status column is what lets the reader filter them out in the sheet.
    expect(rows[1]?.status).toBe("CANCELLED");
  });

  it("writes timestamps in Jakarta time, big-endian", async () => {
    const { getOrdersForExport } = await import("@/lib/queries/report.query");
    const product = await makeProduct({ stock: 100 });
    const today = Temporal.Now.zonedDateTimeISO(JAKARTA).startOfDay();

    const order = await place({
      channel: "ONSITE",
      paymentStatus: "PAID",
      items: [{ productId: product.id, quantity: 1 }],
    });
    // 11:05 Jakarta is 04:05 UTC; a UTC timestamp would misdate the report.
    await backdate(order.id, today.add({ hours: 11, minutes: 5 }).toInstant());

    const [row] = await getOrdersForExport();
    const expectedDate = today.toPlainDate().toString();

    expect(row?.createdAt).toBe(`${expectedDate} 11:05`);
  });

  it("prices each exported line at its snapshot, not the menu's price today", async () => {
    const { getOrderItemsForExport } = await import("@/lib/queries/report.query");
    const product = await makeProduct({ name: "Es Teh", price: 5_000, stock: 100 });

    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 4 }] });
    await db.orm.public.Product.where({ id: product.id }).update({ price: 12_000 });

    const rows = await getOrderItemsForExport();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      productName: "Es Teh",
      quantity: 4,
      priceAtOrder: 5_000,
      subtotal: 20_000,
    });
  });

  it("lists a menu that never sold, at zero", async () => {
    const { getProductRecapForExport } = await import("@/lib/queries/report.query");
    const sold = await makeProduct({ name: "Cimol", price: 5_000, stock: 100 });
    await makeProduct({ name: "Batagor", price: 8_000, stock: 40 });

    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: sold.id, quantity: 3 }] });

    const rows = await getProductRecapForExport();

    expect(rows.map((row) => row.name)).toEqual(["Cimol", "Batagor"]);
    // What did not move is as much a finding as what did.
    expect(rows[1]).toMatchObject({ name: "Batagor", quantitySold: 0, revenue: 0, stock: 40 });
  });

  it("recaps each menu the way the dashboard's ranking does", async () => {
    const { getProductRecapForExport } = await import("@/lib/queries/report.query");
    const kasir = await makeUser("KASIR");
    const product = await makeProduct({ name: "Seblak", price: 10_000, stock: 100, prepType: "NEEDS_PREP" });

    await place({ channel: "ONSITE", paymentStatus: "PAID", items: [{ productId: product.id, quantity: 2 }] });
    await place({ channel: "PREORDER", paymentStatus: "UNPAID", items: [{ productId: product.id, quantity: 3 }] });
    const voided = await place({
      channel: "ONSITE",
      paymentStatus: "PAID",
      items: [{ productId: product.id, quantity: 7 }],
    });
    await cancelOrder(voided.id, { id: kasir.id, role: "KASIR" });

    const [recap] = await getProductRecapForExport();
    const [ranked] = await getTopProducts(1);

    // Cancellation dropped, unpaid counted as portions but not as money —
    // exactly what the "Lagi laris" card reports.
    expect(recap).toMatchObject({ quantitySold: 5, revenue: 20_000 });
    expect(recap?.quantitySold).toBe(ranked?.quantitySold);
    expect(recap?.revenue).toBe(ranked?.revenue);
  });
});
