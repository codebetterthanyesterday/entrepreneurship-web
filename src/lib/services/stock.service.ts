import { prisma as db } from "@/lib/prisma";
import { InsufficientStockError, NotFoundError } from "@/lib/errors";
import type { TxClient } from "@/lib/db-types";

export type StockReason =
  | "INITIAL_STOCK"
  | "ORDER_CONFIRMED"
  | "ORDER_CANCELLED"
  | "MANUAL_ADJUST"
  | "WASTE";

export interface AdjustStockInput {
  /**
   * Optional transaction context. When the caller is already inside
   * `db.transaction(...)` it passes its `tx` so the stock change joins that
   * transaction instead of opening a nested one.
   */
  tx?: TxClient;
  productId: string;
  delta: number;
  reason: StockReason;
  actorId?: string | null;
  orderId?: string | null;
}

export async function adjustStock({
  tx,
  productId,
  delta,
  reason,
  actorId,
  orderId,
}: AdjustStockInput) {
  const run = async (t: TxClient) => {
    const product = await t.orm.public.Product.where({ id: productId }).first();
    if (!product) {
      throw new NotFoundError("Menunya nggak ketemu");
    }

    if (delta < 0) {
      const quantity = Math.abs(delta);

      // Atomic guarded decrement. The `stock >= quantity` predicate lives in
      // the UPDATE itself, so two concurrent orders can never oversell: the
      // loser matches zero rows instead of writing a negative stock.
      const plan = db.raw
        .sql`UPDATE "public"."product" SET "stock" = "stock" - ${quantity} WHERE "id" = ${productId} AND "stock" >= ${quantity}`
        .affectedCount()
        .build();

      const { affectedRows } = await t.execute(plan);
      if (affectedRows === 0) {
        throw new InsufficientStockError(product.name);
      }
    } else if (delta > 0) {
      const plan = db.raw
        .sql`UPDATE "public"."product" SET "stock" = "stock" + ${delta} WHERE "id" = ${productId}`
        .affectedCount()
        .build();

      await t.execute(plan);
    }

    if (delta !== 0) {
      await t.orm.public.StockMovement.create({
        productId,
        quantity: delta,
        reason,
        actorId: actorId ?? null,
        orderId: orderId ?? null,
      });
    }

    const updated = await t.orm.public.Product.where({ id: productId }).first();
    if (!updated) throw new NotFoundError("Menunya nggak ketemu");

    return updated;
  };

  return tx ? await run(tx) : await db.transaction(run);
}

export async function getStockHistory(productId: string) {
  return await db.orm.public.StockMovement.where({ productId })
    .orderBy((s) => s.createdAt.desc())
    .all();
}
