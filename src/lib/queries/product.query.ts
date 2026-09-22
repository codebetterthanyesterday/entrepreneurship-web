import { prisma as db } from "@/lib/prisma";

export async function getActiveProducts() {
  const products = await db.orm.public.Product
    .where({ isActive: true })
    .include('category')
    .all();
    
  // Sort in memory to avoid complex relation sorting syntax which might vary in Prisma 8
  return products.sort((a, b) => {
    const orderA = a.category?.sortOrder ?? 999;
    const orderB = b.category?.sortOrder ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
}

export async function getAllProducts() {
  const products = await db.orm.public.Product
    .include('category')
    .all();
    
  return products.sort((a, b) => {
    const orderA = a.category?.sortOrder ?? 999;
    const orderB = b.category?.sortOrder ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
}

export async function getLowStockProducts(threshold: number) {
  return await db.orm.public.Product
    .where({ isActive: true })
    .where((p) => p.stock.lte(threshold))
    .include('category')
    .all();
}

export async function getCategories() {
  return await db.orm.public.Category.orderBy((c) => c.sortOrder.asc()).all();
}

/**
 * Units sold per product, keyed by product id. Cancelled orders do not count.
 */
export async function getProductSalesCounts(): Promise<Record<string, number>> {
  const plan = db.raw.sql`
    SELECT oi."productId" AS "productId", SUM(oi."quantity")::int AS "sold"
    FROM "public"."orderItem" oi
    JOIN "public"."order" o ON o."id" = oi."orderId"
    WHERE o."status" <> 'CANCELLED'
    GROUP BY oi."productId"
  `
    .returnsRow({ productId: "pg/text@1", sold: "pg/int4@1" })
    .build();

  const rows = await db.runtime().query(plan);

  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.productId] = row.sold;
    return acc;
  }, {});
}
