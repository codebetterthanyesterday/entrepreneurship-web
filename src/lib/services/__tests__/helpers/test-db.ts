import { prisma as db } from "@/lib/prisma";
import type { ProductPrepType, UserRole } from "@/types/order";

/**
 * Guard against a mis-wired environment wiping real data: vitest.config.ts
 * points DATABASE_URL at DATABASE_URL_TEST, and this refuses to truncate
 * anything if that did not happen.
 */
function assertTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";

  if (!url.includes("test")) {
    throw new Error(
      `Refusing to truncate: DATABASE_URL does not look like a test database (${url}).`,
    );
  }
}

const TABLES = [
  "stockMovement",
  "orderItem",
  "order",
  "product",
  "category",
  "pickupSlot",
  "user",
  // Profile content, so a test that edits a text block or a list does not leave
  // it behind for the next one.
  "siteText",
  "siteListItem",
];

/**
 * `db.raw.sql` is a tagged template whose `${}` slots become bind parameters,
 * and a table name cannot be a bind parameter. Calling the tag directly with a
 * single-chunk template puts the text in verbatim. Only ever called with the
 * hard-coded TABLES above — never with anything from outside this file.
 */
function rawStatement(sql: string) {
  const chunks = Object.assign([sql], { raw: [sql] }) as unknown as TemplateStringsArray;
  return db.raw.sql(chunks);
}

/**
 * Empty every table and rewind the order-number sequences, so each test starts
 * from PO-0001 / OS-0001 and from a known row count.
 */
export async function resetDatabase(): Promise<void> {
  assertTestDatabase();

  const quoted = TABLES.map((table) => `"public"."${table}"`).join(", ");

  await db.runtime().execute(
    rawStatement(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`).affectedCount().build(),
  );

  for (const sequence of ["order_seq_preorder", "order_seq_onsite"]) {
    await db.runtime().execute(
      db.raw.sql`SELECT setval(${`public.${sequence}`}::regclass, 1, false)`
        .affectedCount()
        .build(),
    );
  }

  await db.orm.public.StoreSetting.where({ id: 1 }).upsert({
    create: { id: 1, preorderOpen: true, boothOpen: true, lowStockThreshold: 3 },
    update: { preorderOpen: true, boothOpen: true, lowStockThreshold: 3 },
  });
}

export async function closeDatabase(): Promise<void> {
  await db.close();
}

export interface MakeProductOptions {
  name?: string;
  price?: number;
  stock?: number;
  prepType?: ProductPrepType;
  isActive?: boolean;
}

export async function makeProduct(options: MakeProductOptions = {}) {
  return await db.orm.public.Product.create({
    name: options.name ?? `Menu Uji ${Math.random().toString(36).slice(2, 8)}`,
    price: options.price ?? 10_000,
    stock: options.stock ?? 10,
    prepType: options.prepType ?? "READY_TO_SERVE",
    isActive: options.isActive ?? true,
  });
}

export async function makeUser(role: UserRole = "KASIR") {
  return await db.orm.public.User.create({
    name: `Uji ${role}`,
    email: `${role.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@uji.test`,
    password: "not-a-real-hash",
    role,
  });
}

export async function makePickupSlot(label: string, quota: number) {
  return await db.orm.public.PickupSlot.create({ label, quota, sortOrder: 1, isActive: true });
}

export async function setStoreOpen(options: {
  preorderOpen?: boolean;
  boothOpen?: boolean;
}): Promise<void> {
  await db.orm.public.StoreSetting.where({ id: 1 }).update(options);
}

/** Removes the singleton settings row, to test that absent config fails closed. */
export async function deleteStoreSettings(): Promise<void> {
  await db.orm.public.StoreSetting.where({ id: 1 }).delete();
}

export async function slotByLabel(label: string) {
  const slot = await db.orm.public.PickupSlot.where({ label }).first();
  if (!slot) throw new Error(`Pickup slot ${label} not found`);
  return slot;
}

export async function itemsOf(orderId: string) {
  return await db.orm.public.OrderItem.where({ orderId }).all();
}

export async function stockOf(productId: string): Promise<number> {
  const product = await db.orm.public.Product.where({ id: productId }).first();
  if (!product) throw new Error(`Product ${productId} not found`);
  return product.stock;
}

export async function countOrders(): Promise<number> {
  const result = await db.orm.public.Order.aggregate((aggregate) => ({
    total: aggregate.count(),
  }));
  return result.total;
}

export async function countOrderItems(): Promise<number> {
  const result = await db.orm.public.OrderItem.aggregate((aggregate) => ({
    total: aggregate.count(),
  }));
  return result.total;
}

export async function movementsFor(productId: string) {
  return await db.orm.public.StockMovement.where({ productId })
    .orderBy((movement) => movement.createdAt.asc())
    .all();
}

export { db };
