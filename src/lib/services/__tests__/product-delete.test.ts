import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { createOrder } from "@/lib/services/order.service";
import { createProduct, deleteProduct } from "@/lib/services/product.service";
import {
  closeDatabase,
  db,
  makeBundle,
  makeProduct,
  makeUser,
  movementsFor,
  resetDatabase,
} from "./helpers/test-db";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("deleting a menu item", () => {
  it("removes one that was never sold, with its stock history", async () => {
    const admin = await makeUser("ADMIN");
    const product = await createProduct(
      { name: "Salah Ketik", price: 15_000, stock: 10, prepType: "READY_TO_SERVE", isActive: true },
      admin.id,
    );
    expect(await movementsFor(product.id)).toHaveLength(1);

    await deleteProduct(product.id);

    expect(await db.orm.public.Product.where({ id: product.id }).first()).toBeNull();
    expect(await movementsFor(product.id)).toHaveLength(0);
  });

  it("refuses one that has been sold, and says to hide it instead", async () => {
    const product = await makeProduct({ stock: 10, prepType: "READY_TO_SERVE" });
    await createOrder({
      channel: "ONSITE",
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      customerName: "Pelanggan booth",
      items: [{ productId: product.id, quantity: 1 }],
    });

    const attempt = deleteProduct(product.id);

    await expect(attempt).rejects.toBeInstanceOf(ValidationError);
    await expect(deleteProduct(product.id)).rejects.toThrow(/Sembunyiin aja/);
    expect(await db.orm.public.Product.where({ id: product.id }).first()).not.toBeNull();
  });

  it("refuses one that is still in a paket", async () => {
    const product = await makeProduct({ stock: 10 });
    await makeBundle({ items: [{ productId: product.id, quantity: 1 }] });

    await expect(deleteProduct(product.id)).rejects.toThrow(/isi paket/);
    expect(await db.orm.public.Product.where({ id: product.id }).first()).not.toBeNull();
  });
});
