import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma as db } from "@/lib/prisma";
import { getStockHistory } from "@/lib/queries/stock-history.query";
import { cancelOrder, createOrder } from "@/lib/services/order.service";
import { createProduct, updateProduct } from "@/lib/services/product.service";
import { closeDatabase, makeUser, resetDatabase } from "@/lib/services/__tests__/helpers/test-db";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

async function product(name: string, stock: number, actorId: string) {
  return await createProduct({ name, price: 10_000, stock, prepType: "READY_TO_SERVE", isActive: true }, actorId);
}

describe("the stock history", () => {
  it("records every move, newest first, with why, who and for which order", async () => {
    const admin = await makeUser("ADMIN");
    const kasir = await makeUser("KASIR");
    const kopi = await product("Kopi", 10, admin.id);
    await updateProduct(kopi.id, { stock: 15 }, admin.id);
    const order = await createOrder({
      // A preorder: it stays open, so it can still be cancelled.
      channel: "PREORDER",
      paymentStatus: "UNPAID",
      paymentMethod: "CASH",
      customerName: "Rani",
      customerPhone: "081234561234",
      handledById: kasir.id,
      items: [{ productId: kopi.id, quantity: 2 }],
    });
    await cancelOrder(order.id, { id: admin.id, role: "ADMIN" });

    const { rows, total } = await getStockHistory({ productId: kopi.id });

    expect(total).toBe(4);
    expect(rows.map((row) => [row.reason, row.quantity, row.actorName])).toEqual([
      ["ORDER_CANCELLED", 2, admin.name],
      ["ORDER_CONFIRMED", -2, kasir.name],
      ["MANUAL_ADJUST", 5, admin.name],
      ["INITIAL_STOCK", 10, admin.name],
    ]);
    expect(rows[1]!.orderNumber).toBe(order.orderNumber);
    expect(rows.every((row) => row.productName === "Kopi")).toBe(true);
  });

  it("shows every product unless one is chosen", async () => {
    const admin = await makeUser("ADMIN");
    const kopi = await product("Kopi", 5, admin.id);
    await product("Teh", 3, admin.id);

    expect((await getStockHistory()).total).toBe(2);
    expect((await getStockHistory({ productId: kopi.id })).rows.map((row) => row.productName)).toEqual(["Kopi"]);
  });

  it("pages by fifty, and a page past the end lands on the last", async () => {
    const admin = await makeUser("ADMIN");
    const kopi = await product("Kopi", 1, admin.id);
    for (let i = 0; i < 55; i++) {
      await db.orm.public.StockMovement.create({ productId: kopi.id, quantity: 1, reason: "MANUAL_ADJUST", actorId: admin.id });
    }

    const first = await getStockHistory({ productId: kopi.id });
    expect([first.rows.length, first.pageCount, first.total]).toEqual([50, 2, 56]);
    const last = await getStockHistory({ productId: kopi.id, page: 9 });
    expect([last.page, last.rows.length]).toEqual([2, 6]);
  });
});
