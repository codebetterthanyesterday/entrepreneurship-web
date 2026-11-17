import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { InsufficientStockError, ValidationError } from "@/lib/errors";
import { cancelOrder, createOrder, type CreateOrderInput } from "@/lib/services/order.service";
import { createBundle, deleteBundle, updateBundle } from "@/lib/services/bundle.service";
import { deleteProduct } from "@/lib/services/product.service";
import { getActiveBundles } from "@/lib/queries/bundle.query";
import { kitchenLineName, pricedLines } from "@/lib/order-lines";
import { getOrderItemsForExport } from "@/lib/queries/report.query";
import {
  closeDatabase,
  countOrders,
  db,
  itemsOf,
  makeBundle,
  makeProduct,
  makeUser,
  movementsFor,
  resetDatabase,
  stockOf,
} from "./helpers/test-db";

function onsite(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
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

async function littlePowerCombo(stock = { roll: 10, tea: 10 }) {
  const roll = await makeProduct({ name: "Chicken Roll", price: 15_000, stock: stock.roll, prepType: "NEEDS_PREP" });
  const tea = await makeProduct({ name: "Milk Tea Bean Curd", price: 10_000, stock: stock.tea });
  const combo = await makeBundle({
    name: "Little Power Combo",
    price: 22_000,
    items: [
      { productId: roll.id, quantity: 1 },
      { productId: tea.id, quantity: 1 },
    ],
  });
  return { roll, tea, combo };
}

describe("ordering a paket", () => {
  it("cuts each product's own stock by what the paket holds, times how many", async () => {
    const { roll, tea, combo } = await littlePowerCombo();

    await createOrder(onsite({ bundles: [{ bundleId: combo.id, quantity: 3 }] }));

    expect(await stockOf(roll.id)).toBe(7);
    expect(await stockOf(tea.id)).toBe(7);
  });

  it("charges the paket's price, not the sum of what is in it", async () => {
    const { combo } = await littlePowerCombo();

    const order = await createOrder(onsite({ bundles: [{ bundleId: combo.id, quantity: 2 }] }));

    expect(order.totalAmount).toBe(44_000);
    expect(order.bundles).toHaveLength(1);
    expect(order.bundles[0]!).toMatchObject({
      name: "Little Power Combo",
      quantity: 2,
      priceAtOrder: 22_000,
      subtotal: 44_000,
    });
  });

  it("records the contents as zero-priced lines tied to the paket", async () => {
    const { combo } = await littlePowerCombo();

    const order = await createOrder(onsite({ bundles: [{ bundleId: combo.id, quantity: 2 }] }));
    const items = await itemsOf(order.id);

    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.orderBundleId).toBe(order.bundles[0]!.id);
      expect(item.quantity).toBe(2);
      expect(item.priceAtOrder).toBe(0);
      expect(item.subtotal).toBe(0);
    }
  });

  it("adds loose products and pakets into one total", async () => {
    const { roll, combo } = await littlePowerCombo();

    const order = await createOrder(
      onsite({
        items: [{ productId: roll.id, quantity: 1 }],
        bundles: [{ bundleId: combo.id, quantity: 1 }],
      }),
    );

    expect(order.totalAmount).toBe(15_000 + 22_000);
    // One loose roll and one inside the combo.
    expect(await stockOf(roll.id)).toBe(8);
  });

  it("leaves one ORDER_CONFIRMED movement per content, linked to the order", async () => {
    const { roll, combo } = await littlePowerCombo();

    const order = await createOrder(onsite({ bundles: [{ bundleId: combo.id, quantity: 1 }] }));
    const movements = await movementsFor(roll.id);

    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ quantity: -1, reason: "ORDER_CONFIRMED", orderId: order.id });
  });

  it("sends an on-the-spot order to the kitchen when a content needs making", async () => {
    const { combo } = await littlePowerCombo();

    const order = await createOrder(onsite({ bundles: [{ bundleId: combo.id, quantity: 1 }] }));

    expect(order.status).toBe("IN_QUEUE");
  });
});

describe("ordering a paket — what it refuses", () => {
  it("rolls everything back when one content runs short, naming that product", async () => {
    const { roll, tea, combo } = await littlePowerCombo({ roll: 5, tea: 1 });

    await expect(
      createOrder(onsite({ bundles: [{ bundleId: combo.id, quantity: 2 }] })),
    ).rejects.toThrow(InsufficientStockError);
    await expect(
      createOrder(onsite({ bundles: [{ bundleId: combo.id, quantity: 2 }] })),
    ).rejects.toThrow(/Milk Tea Bean Curd/);

    expect(await stockOf(roll.id)).toBe(5);
    expect(await stockOf(tea.id)).toBe(1);
    expect(await countOrders()).toBe(0);
  });

  it("counts a loose product and the same product in a paket against one stock", async () => {
    const { roll, combo } = await littlePowerCombo({ roll: 1, tea: 10 });

    await expect(
      createOrder(
        onsite({
          items: [{ productId: roll.id, quantity: 1 }],
          bundles: [{ bundleId: combo.id, quantity: 1 }],
        }),
      ),
    ).rejects.toThrow(InsufficientStockError);

    expect(await stockOf(roll.id)).toBe(1);
  });

  it("refuses a paket that is switched off", async () => {
    const { combo } = await littlePowerCombo();
    await db.orm.public.Bundle.where({ id: combo.id }).update({ isActive: false });

    await expect(
      createOrder(onsite({ bundles: [{ bundleId: combo.id, quantity: 1 }] })),
    ).rejects.toThrow(ValidationError);
  });

  it("refuses a paket whose product was hidden, whatever the paket's own switch says", async () => {
    const { tea, combo } = await littlePowerCombo();
    await db.orm.public.Product.where({ id: tea.id }).update({ isActive: false });

    await expect(
      createOrder(onsite({ bundles: [{ bundleId: combo.id, quantity: 1 }] })),
    ).rejects.toThrow(/Little Power Combo/);
  });

  it("refuses a basket with neither products nor pakets", async () => {
    await expect(createOrder(onsite())).rejects.toThrow(ValidationError);
  });
});

describe("cancelling an order with a paket", () => {
  it("puts every content back in its own product's stock", async () => {
    const { roll, tea, combo } = await littlePowerCombo();
    const admin = await makeUser("ADMIN");
    const order = await createOrder(
      onsite({ bundles: [{ bundleId: combo.id, quantity: 2 }], channel: "PREORDER", paymentStatus: "UNPAID" }),
    );

    await cancelOrder(order.id, { id: admin.id, role: admin.role });

    expect(await stockOf(roll.id)).toBe(10);
    expect(await stockOf(tea.id)).toBe(10);
  });
});

describe("a paket on the bill", () => {
  it("is one priced line with its contents, never 'Chicken Roll Rp0'", async () => {
    const { roll, combo } = await littlePowerCombo();
    const order = await createOrder(
      onsite({
        items: [{ productId: roll.id, quantity: 1 }],
        bundles: [{ bundleId: combo.id, quantity: 2 }],
      }),
    );

    const lines = pricedLines(order);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ name: "Chicken Roll", quantity: 1, subtotal: 15_000, contents: null });
    expect(lines[1]).toMatchObject({
      name: "Little Power Combo",
      quantity: 2,
      subtotal: 44_000,
      contents: "1× Chicken Roll, 1× Milk Tea Bean Curd",
      needsPrep: true,
    });
    expect(lines.every((line) => line.subtotal > 0)).toBe(true);
  });

  it("tells the kitchen which roll came in the combo", async () => {
    const { roll, combo } = await littlePowerCombo();
    const order = await createOrder(
      onsite({
        items: [{ productId: roll.id, quantity: 1 }],
        bundles: [{ bundleId: combo.id, quantity: 1 }],
      }),
    );

    const names = order.items.map((item) => kitchenLineName(item, order.bundles)).sort();

    expect(names).toEqual([
      "Chicken Roll",
      "Chicken Roll · Little Power Combo",
      "Milk Tea Bean Curd · Little Power Combo",
    ]);
  });

  it("keeps the name and price it was sold at after the paket is edited", async () => {
    const { roll, tea, combo } = await littlePowerCombo();
    const order = await createOrder(onsite({ bundles: [{ bundleId: combo.id, quantity: 1 }] }));

    await updateBundle(combo.id, {
      name: "Combo Baru",
      price: 30_000,
      isActive: true,
      sortOrder: 0,
      items: [
        { productId: roll.id, quantity: 2 },
        { productId: tea.id, quantity: 1 },
      ],
    });

    const kept = await db.orm.public.OrderBundle.where({ orderId: order.id }).first();
    expect(kept).toMatchObject({ name: "Little Power Combo", priceAtOrder: 22_000 });
    expect((await itemsOf(order.id)).map((item) => item.quantity)).toEqual([1, 1]);
  });
});

describe("managing pakets", () => {
  it("creates a paket with its contents", async () => {
    const roll = await makeProduct({ price: 15_000 });
    const tea = await makeProduct({ price: 10_000 });

    const bundle = await createBundle({
      name: "Paket A",
      price: 22_000,
      isActive: true,
      sortOrder: 0,
      items: [
        { productId: roll.id, quantity: 1 },
        { productId: tea.id, quantity: 2 },
      ],
    });

    const contents = await db.orm.public.BundleItem.where({ bundleId: bundle.id }).all();
    expect(contents).toHaveLength(2);
  });

  it("refuses to delete a paket that was ever ordered", async () => {
    const { combo } = await littlePowerCombo();
    await createOrder(onsite({ bundles: [{ bundleId: combo.id, quantity: 1 }] }));

    await expect(deleteBundle(combo.id)).rejects.toThrow(ValidationError);
  });

  it("deletes a paket nobody ordered, contents and all", async () => {
    const { combo } = await littlePowerCombo();

    await deleteBundle(combo.id);

    expect(await db.orm.public.BundleItem.where({ bundleId: combo.id }).first()).toBeNull();
  });

  it("refuses to delete a product while a paket still holds it", async () => {
    const { tea } = await littlePowerCombo();

    await expect(deleteProduct(tea.id)).rejects.toThrow(/isi paket/);
  });
});

describe("pakets on the menu", () => {
  it("offers an active paket with its normal price worked out", async () => {
    await littlePowerCombo();

    const [bundle] = await getActiveBundles();

    expect(bundle).toMatchObject({ name: "Little Power Combo", price: 22_000, normalPrice: 25_000 });
    expect(bundle!.items.map((item) => item.name)).toEqual(["Chicken Roll", "Milk Tea Bean Curd"]);
  });

  it("leaves out a paket that is off, or holds a hidden product", async () => {
    const { tea, combo } = await littlePowerCombo();
    await db.orm.public.Product.where({ id: tea.id }).update({ isActive: false });

    expect(await getActiveBundles()).toEqual([]);

    await db.orm.public.Product.where({ id: tea.id }).update({ isActive: true });
    await db.orm.public.Bundle.where({ id: combo.id }).update({ isActive: false });

    expect(await getActiveBundles()).toEqual([]);
  });
});

describe("a paket in the item export", () => {
  it("is its own priced row, with its contents labelled at zero", async () => {
    const { combo } = await littlePowerCombo();
    await createOrder(onsite({ bundles: [{ bundleId: combo.id, quantity: 2 }] }));

    const rows = await getOrderItemsForExport();

    expect(rows).toHaveLength(3);
    expect(rows.find((row) => row.productName === "Paket: Little Power Combo")).toMatchObject({
      quantity: 2,
      priceAtOrder: 22_000,
      subtotal: 44_000,
    });
    expect(rows.find((row) => row.productName === "Chicken Roll (isi Little Power Combo)")).toMatchObject({
      quantity: 2,
      subtotal: 0,
    });
    // The sheet's money adds up to what the order cost, not more.
    expect(rows.reduce((sum, row) => sum + row.subtotal, 0)).toBe(44_000);
  });
});
