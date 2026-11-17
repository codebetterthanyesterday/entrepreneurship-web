import { prisma as db } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { TxClient } from "@/lib/db-types";
import type { BundleInput } from "@/lib/validations/bundle.schema";

/**
 * Checks that every product a bundle names exists. A hidden product is
 * allowed — the admin may be setting a combo up before the day starts — and
 * the catalogue simply does not offer the bundle until it is back on sale.
 */
async function assertProductsExist(tx: TxClient, productIds: readonly string[]): Promise<void> {
  const found = await tx.orm.public.Product.where((product) => product.id.in([...productIds])).all();

  if (found.length !== new Set(productIds).size) {
    throw new ValidationError("Ada menu isi paket yang udah nggak ada", "items");
  }
}

function bundleRow(input: BundleInput) {
  return {
    name: input.name,
    description: input.description || null,
    price: input.price,
    imageUrl: input.imageUrl || null,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  };
}

export async function createBundle(input: BundleInput) {
  return await db.transaction(async (tx) => {
    await assertProductsExist(tx, input.items.map((item) => item.productId));

    const bundle = await tx.orm.public.Bundle.create(bundleRow(input));

    for (const item of input.items) {
      await tx.orm.public.BundleItem.create({
        bundleId: bundle.id,
        productId: item.productId,
        quantity: item.quantity,
      });
    }

    return bundle;
  });
}

/**
 * Replaces a bundle's details and its contents.
 *
 * Changing what is in a bundle never touches orders already placed: each order
 * kept its own copy of the contents as order lines, and of the name and price
 * on its `OrderBundle` row.
 */
export async function updateBundle(id: string, input: BundleInput) {
  return await db.transaction(async (tx) => {
    const current = await tx.orm.public.Bundle.where({ id }).first();
    if (!current) throw new NotFoundError("Paketnya nggak ketemu");

    await assertProductsExist(tx, input.items.map((item) => item.productId));

    await tx.orm.public.Bundle.where({ id }).update(bundleRow(input));

    const clear = db.raw
      .sql`DELETE FROM "public"."bundleItem" WHERE "bundleId" = ${id}`
      .affectedCount()
      .build();
    await tx.execute(clear);

    for (const item of input.items) {
      await tx.orm.public.BundleItem.create({
        bundleId: id,
        productId: item.productId,
        quantity: item.quantity,
      });
    }

    return await tx.orm.public.Bundle.where({ id }).first();
  });
}

export async function toggleBundleActive(id: string) {
  const bundle = await db.orm.public.Bundle.where({ id }).first();
  if (!bundle) throw new NotFoundError("Paketnya nggak ketemu");

  const updated = await db.orm.public.Bundle.where({ id }).update({ isActive: !bundle.isActive });
  if (!updated) throw new NotFoundError("Paketnya nggak ketemu");

  return updated;
}

/**
 * Deletes a bundle that was never ordered. One that was stays, hidden: its
 * orders point at it, and the history of what was sold has to stay readable.
 */
export async function deleteBundle(id: string) {
  return await db.transaction(async (tx) => {
    const bundle = await tx.orm.public.Bundle.where({ id }).first();
    if (!bundle) throw new NotFoundError("Paketnya nggak ketemu");

    const ordered = await tx.orm.public.OrderBundle.where({ bundleId: id }).first();
    if (ordered) {
      throw new ValidationError(
        "Paket ini udah pernah kejual jadi nggak bisa dihapus. Sembunyiin aja dari katalog ya.",
      );
    }

    // The contents go with it (`onDelete: Cascade` on BundleItem).
    await tx.orm.public.Bundle.where({ id }).delete();
  });
}
