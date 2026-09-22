import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  findByNumber,
  findForTracking,
  findKitchenQueue,
  findPreordersForCashier,
  toCashierPreorder,
  toKitchenTicket,
  toTrackedOrder,
} from "@/lib/queries/order.query";
import {
  cancelOrder,
  createOrder,
  markAsPaid,
  transitionStatus,
} from "@/lib/services/order.service";
import {
  closeDatabase,
  db,
  makePickupSlot,
  makeProduct,
  makeUser,
  resetDatabase,
} from "@/lib/services/__tests__/helpers/test-db";

const SLOT = "09.00 - 10.00";
const PHONE = "081234567890";

async function placeOrder(options: { phone?: string | null; prep?: boolean } = {}) {
  const product = await makeProduct({
    name: "Croffle Butter Sugar",
    price: 20_000,
    stock: 20,
    prepType: options.prep === false ? "READY_TO_SERVE" : "NEEDS_PREP",
  });
  await makePickupSlot(SLOT, 20);

  return await createOrder({
    channel: "PREORDER",
    paymentStatus: "UNPAID",
    paymentMethod: "CASH",
    customerName: "Pelanggan Uji",
    customerPhone: options.phone === undefined ? PHONE : options.phone,
    pickupSlot: SLOT,
    items: [{ productId: product.id, quantity: 2 }],
  });
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("findByNumber", () => {
  it("finds an order by its number alone", async () => {
    const created = await placeOrder();

    const found = await findByNumber(created.orderNumber);

    expect(found).not.toBeNull();
    expect(found!.orderNumber).toBe(created.orderNumber);
    expect(found!.items).toHaveLength(1);
  });

  it("returns null for a number that does not exist", async () => {
    expect(await findByNumber("PO-9999")).toBeNull();
  });
});

describe("findForTracking — the privacy gate", () => {
  it("returns the order when the last four digits match", async () => {
    const created = await placeOrder();

    const found = await findForTracking(created.orderNumber, "7890");

    expect(found).not.toBeNull();
    expect(found!.orderNumber).toBe(created.orderNumber);
  });

  it("returns null — not an error — when the digits are wrong", async () => {
    const created = await placeOrder();

    // The same answer as an unknown number. Order numbers run in sequence, so
    // telling the two apart would let someone walk PO-0001 upward and learn
    // which orders exist.
    expect(await findForTracking(created.orderNumber, "0000")).toBeNull();
    expect(await findForTracking("PO-9999", "7890")).toBeNull();
  });

  it("gives the same answer whether the number exists or not", async () => {
    const created = await placeOrder();

    const wrongDigits = await findForTracking(created.orderNumber, "1111");
    const unknownNumber = await findForTracking("PO-9999", "1111");

    expect(wrongDigits).toEqual(unknownNumber);
  });

  it("refuses an order saved without a phone number", async () => {
    const created = await placeOrder({ phone: null });

    expect(await findForTracking(created.orderNumber, "7890")).toBeNull();
    expect(await findForTracking(created.orderNumber, "")).toBeNull();
  });

  it("rejects fewer than four digits outright", async () => {
    const created = await placeOrder();

    expect(await findForTracking(created.orderNumber, "890")).toBeNull();
  });

  it("ignores spaces and dashes in the stored number", async () => {
    const created = await placeOrder();
    await db.orm.public.Order.where({ id: created.id }).update({
      customerPhone: "0812-3456-7890",
    });

    expect(await findForTracking(created.orderNumber, "7890")).not.toBeNull();
  });
});

describe("toTrackedOrder", () => {
  it("prices lines from the snapshot, not from the product today", async () => {
    const created = await placeOrder();

    await db.orm.public.Product.where({ id: created.items[0]!.productId }).update({
      price: 99_000,
    });

    const view = toTrackedOrder((await findByNumber(created.orderNumber))!);

    expect(view.items[0]!.priceAtOrder).toBe(20_000);
    expect(view.items[0]!.subtotal).toBe(40_000);
    expect(view.totalAmount).toBe(40_000);
  });

  it("flags an order that has something to make", async () => {
    const withPrep = await placeOrder({ prep: true });
    expect(toTrackedOrder((await findByNumber(withPrep.orderNumber))!).needsPrep).toBe(true);

    await resetDatabase();

    const readyOnly = await placeOrder({ prep: false });
    expect(toTrackedOrder((await findByNumber(readyOnly.orderNumber))!).needsPrep).toBe(false);
  });

  it("carries only plain values, so it survives JSON", async () => {
    const created = await placeOrder();

    const view = toTrackedOrder((await findByNumber(created.orderNumber))!);

    // A Temporal instant would throw or degrade here; the view model has none.
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it("reflects a cancellation", async () => {
    const kasir = await makeUser("KASIR");
    const created = await placeOrder();

    await cancelOrder(created.id, { id: kasir.id, role: "KASIR" }, "berubah pikiran");

    const view = toTrackedOrder((await findByNumber(created.orderNumber))!);

    expect(view.status).toBe("CANCELLED");
    expect(view.notes).toContain("berubah pikiran");
  });
});

describe("findPreordersForCashier", () => {
  async function makeCounterOrders() {
    const ready = await makeProduct({ name: "Puding Susu Cup", price: 12_000, stock: 50 });
    const racik = await makeProduct({
      name: "Es Kopi Susu",
      price: 18_000,
      stock: 50,
      prepType: "NEEDS_PREP",
    });
    await makePickupSlot("09.00 - 10.00", 20);
    await makePickupSlot("10.00 - 11.00", 20);

    const salsa = await createOrder({
      channel: "PREORDER",
      paymentStatus: "UNPAID",
      paymentMethod: "QRIS",
      customerName: "Salsa Amelia",
      customerPhone: PHONE,
      pickupSlot: "10.00 - 11.00",
      items: [{ productId: racik.id, quantity: 2 }],
    });

    const rizky = await createOrder({
      channel: "PREORDER",
      paymentStatus: "UNPAID",
      paymentMethod: "CASH",
      customerName: "Rizky",
      customerPhone: PHONE,
      pickupSlot: "09.00 - 10.00",
      items: [{ productId: ready.id, quantity: 1 }],
    });

    return { salsa, rizky, ready, racik };
  }

  it("returns only preorders, ordered by pickup slot", async () => {
    const { salsa, rizky, ready } = await makeCounterOrders();

    await createOrder({
      channel: "ONSITE",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      customerName: "Pelanggan booth",
      items: [{ productId: ready.id, quantity: 1 }],
    });

    const found = await findPreordersForCashier();

    // Rizky is due at 09.00 and ordered second; the slot decides, not the clock.
    expect(found.map((order) => order.orderNumber)).toEqual([
      rizky.orderNumber,
      salsa.orderNumber,
    ]);
  });

  it("searches the order number and the customer name, case-insensitively", async () => {
    const { salsa } = await makeCounterOrders();

    const byName = await findPreordersForCashier({ search: "salsa" });
    expect(byName.map((order) => order.orderNumber)).toEqual([salsa.orderNumber]);

    const byPartialName = await findPreordersForCashier({ search: "AMELIA" });
    expect(byPartialName.map((order) => order.orderNumber)).toEqual([salsa.orderNumber]);

    const byNumber = await findPreordersForCashier({ search: salsa.orderNumber.toLowerCase() });
    expect(byNumber.map((order) => order.orderNumber)).toEqual([salsa.orderNumber]);
  });

  it("treats a wildcard as a literal rather than as 'everything'", async () => {
    await makeCounterOrders();

    expect(await findPreordersForCashier({ search: "%" })).toHaveLength(0);
    expect(await findPreordersForCashier({ search: "_" })).toHaveLength(0);
  });

  it("filters by status, taking several at once", async () => {
    const { salsa, rizky } = await makeCounterOrders();
    const kasir = await makeUser("KASIR");

    await markAsPaid(salsa.id, { id: kasir.id, role: "KASIR" });
    await transitionStatus(salsa.id, "IN_QUEUE", { id: kasir.id, role: "KASIR" });

    const kitchen = await findPreordersForCashier({ status: ["IN_QUEUE", "IN_PROGRESS"] });
    expect(kitchen.map((order) => order.orderNumber)).toEqual([salsa.orderNumber]);

    const waiting = await findPreordersForCashier({ status: ["CONFIRMED"] });
    expect(waiting.map((order) => order.orderNumber)).toEqual([rizky.orderNumber]);
  });

  it("ignores an empty search and an empty status list", async () => {
    await makeCounterOrders();

    expect(await findPreordersForCashier({ search: "   ", status: [] })).toHaveLength(2);
  });
});

describe("toCashierPreorder", () => {
  it("carries what the counter needs, from the price snapshot", async () => {
    const created = await placeOrder({ prep: true });

    await db.orm.public.Product.where({ id: created.items[0]!.productId }).update({
      price: 99_000,
    });

    const [order] = await findPreordersForCashier({ search: created.orderNumber });
    const view = toCashierPreorder(order!);

    expect(view.id).toBe(created.id);
    expect(view.itemCount).toBe(2);
    expect(view.needsPrep).toBe(true);
    expect(view.items[0]).toMatchObject({ priceAtOrder: 20_000, subtotal: 40_000, needsPrep: true });
    expect(view.totalAmount).toBe(40_000);
  });

  it("carries only plain values, so it survives JSON", async () => {
    const created = await placeOrder();

    const [order] = await findPreordersForCashier({ search: created.orderNumber });
    const view = toCashierPreorder(order!);

    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });
});

describe("findKitchenQueue", () => {
  async function queueOrder(options: { prep?: boolean; name?: string } = {}) {
    const product = await makeProduct({
      name: options.name ?? "Es Kopi Susu",
      price: 18_000,
      stock: 50,
      prepType: options.prep === false ? "READY_TO_SERVE" : "NEEDS_PREP",
    });

    // An on-the-spot sale with something to make is queued as it is rung up.
    return await createOrder({
      channel: "ONSITE",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      customerName: options.name ?? "Pelanggan booth",
      items: [{ productId: product.id, quantity: 2 }],
    });
  }

  it("returns only what the kitchen currently has", async () => {
    const kasir = await makeUser("KASIR");
    const dapur = await makeUser("DAPUR");

    const queued = await queueOrder({ name: "Antri" });
    const cooking = await queueOrder({ name: "Diracik" });
    const ready = await queueOrder({ name: "Siap" });

    await transitionStatus(cooking.id, "IN_PROGRESS", { id: dapur.id, role: "DAPUR" });
    await transitionStatus(ready.id, "IN_PROGRESS", { id: dapur.id, role: "DAPUR" });
    await transitionStatus(ready.id, "READY", { id: dapur.id, role: "DAPUR" });

    // Neither of these belongs on the board.
    const handedOver = await queueOrder({ name: "Selesai" });
    await transitionStatus(handedOver.id, "IN_PROGRESS", { id: dapur.id, role: "DAPUR" });
    await transitionStatus(handedOver.id, "READY", { id: dapur.id, role: "DAPUR" });
    await transitionStatus(handedOver.id, "DONE", { id: kasir.id, role: "KASIR" });

    const nothingToMake = await queueOrder({ prep: false, name: "Langsung" });
    expect(nothingToMake.status).toBe("DONE");

    const board = await findKitchenQueue();

    expect(board.map((order) => order.customerName).sort()).toEqual([
      "Antri",
      "Diracik",
      "Siap",
    ]);
    expect(board.map((order) => order.orderNumber)).toContain(queued.orderNumber);
  });

  it("puts the longest wait first, by queue time rather than order time", async () => {
    const product = await makeProduct({ stock: 50, prepType: "NEEDS_PREP" });
    await makePickupSlot(SLOT, 20);

    // Placed first, but it only reaches the kitchen when the customer turns up.
    const preorder = await createOrder({
      channel: "PREORDER",
      paymentStatus: "UNPAID",
      paymentMethod: "CASH",
      customerName: "Preorder pagi",
      customerPhone: PHONE,
      pickupSlot: SLOT,
      items: [{ productId: product.id, quantity: 1 }],
    });

    await createOrder({
      channel: "ONSITE",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      customerName: "Booth siang",
      items: [{ productId: product.id, quantity: 1 }],
    });

    // The booth sale was queued on creation; the preorder is queued only now.
    const kasir = await makeUser("KASIR");
    await transitionStatus(preorder.id, "IN_QUEUE", { id: kasir.id, role: "KASIR" });

    const board = await findKitchenQueue();

    // Sorting on createdAt would have put the preorder first and starved the
    // booth queue behind it.
    expect(board.map((order) => order.customerName)).toEqual(["Booth siang", "Preorder pagi"]);
  });
});

describe("toKitchenTicket", () => {
  it("carries the lines, the notes and ISO timestamps", async () => {
    const product = await makeProduct({ name: "Croffle", stock: 10, prepType: "NEEDS_PREP" });
    const extra = await makeProduct({ name: "Puding", stock: 10, prepType: "READY_TO_SERVE" });

    const created = await createOrder({
      channel: "ONSITE",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      customerName: "Bagas",
      notes: "jangan pedas",
      items: [
        { productId: product.id, quantity: 2 },
        { productId: extra.id, quantity: 1 },
      ],
    });

    const [order] = await findKitchenQueue();
    const ticket = toKitchenTicket(order!);

    expect(ticket.id).toBe(created.id);
    expect(ticket.status).toBe("IN_QUEUE");
    expect(ticket.channel).toBe("ONSITE");
    expect(ticket.notes).toBe("jangan pedas");
    expect(ticket.items).toEqual(
      expect.arrayContaining([
        { name: "Croffle", quantity: 2, needsPrep: true },
        { name: "Puding", quantity: 1, needsPrep: false },
      ]),
    );

    // The board polls this over JSON, so every instant has to already be a
    // string a browser can parse.
    expect(typeof ticket.queuedAt).toBe("string");
    expect(Number.isNaN(Date.parse(ticket.queuedAt!))).toBe(false);
    expect(ticket.startedAt).toBeNull();
    expect(Number.isNaN(Date.parse(ticket.createdAt))).toBe(false);
  });

  it("carries only plain values, so it survives JSON", async () => {
    const product = await makeProduct({ stock: 10, prepType: "NEEDS_PREP" });
    await createOrder({
      channel: "ONSITE",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      customerName: "Uji",
      items: [{ productId: product.id, quantity: 1 }],
    });

    const ticket = toKitchenTicket((await findKitchenQueue())[0]!);

    expect(JSON.parse(JSON.stringify(ticket))).toEqual(ticket);
  });
});
