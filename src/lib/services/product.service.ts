import type { z } from "zod";
import { prisma as db } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { TxClient } from "@/lib/db-types";
import type { createProductSchema, updateProductSchema } from "@/lib/validations/product.schema";
import { adjustStock } from "./stock.service";

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export async function createProduct(input: CreateProductInput, actorId?: string) {
  return await db.transaction(async (tx: TxClient) => {
    const { stock, ...productData } = input;
    const initialStock = stock ?? 0;

    const product = await tx.orm.public.Product.create({
      ...productData,
      stock: initialStock,
    });

    if (initialStock > 0) {
      await tx.orm.public.StockMovement.create({
        productId: product.id,
        quantity: initialStock,
        reason: "INITIAL_STOCK",
        actorId: actorId ?? null,
      });
    }

    return product;
  });
}

export async function updateProduct(id: string, input: UpdateProductInput, actorId?: string) {
  return await db.transaction(async (tx: TxClient) => {
    const { stock, ...productData } = input;

    const current = await tx.orm.public.Product.where({ id }).first();
    if (!current) throw new NotFoundError("Menunya nggak ketemu");

    if (Object.keys(productData).length > 0) {
      await tx.orm.public.Product.where({ id }).update(productData);
    }

    // Stock is never set directly — the difference goes through adjustStock so
    // every change leaves a StockMovement trail.
    if (stock !== undefined && stock !== null) {
      const delta = stock - current.stock;
      if (delta !== 0) {
        await adjustStock({
          tx,
          productId: id,
          delta,
          reason: "MANUAL_ADJUST",
          actorId,
        });
      }
    }

    return await tx.orm.public.Product.where({ id }).first();
  });
}

export async function toggleActive(id: string) {
  const product = await db.orm.public.Product.where({ id }).first();
  if (!product) throw new NotFoundError("Menunya nggak ketemu");

  const updated = await db.orm.public.Product.where({ id }).update({
    isActive: !product.isActive,
  });
  if (!updated) throw new NotFoundError("Menunya nggak ketemu");

  return updated;
}

export async function deleteProduct(id: string) {
  return await db.transaction(async (tx: TxClient) => {
    const product = await tx.orm.public.Product.where({ id }).first();
    if (!product) throw new NotFoundError("Menunya nggak ketemu");

    const orderItem = await tx.orm.public.OrderItem.where({ productId: id }).first();
    if (orderItem) {
      throw new ValidationError(
        "Menu ini udah pernah kejual jadi nggak bisa dihapus. Sembunyiin aja dari katalog ya.",
      );
    }

    // A product that was never ordered only carries its own INITIAL_STOCK /
    // MANUAL_ADJUST trail, which must go first to satisfy the foreign key.
    // The ORM delete only removes a single row, so the trail goes through raw SQL.
    const clearTrail = db.raw
      .sql`DELETE FROM "public"."stockMovement" WHERE "productId" = ${id}`
      .affectedCount()
      .build();

    await tx.execute(clearTrail);
    await tx.orm.public.Product.where({ id }).delete();
  });
}
