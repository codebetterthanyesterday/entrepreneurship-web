import { prisma as db } from "@/lib/prisma";
import { Temporal } from "@js-temporal/polyfill";
import { todayInJakarta } from "@/lib/schedule";
import { openServiceDay } from "@/lib/services/schedule.service";
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
  "productImage",
  "storedImage",
  "serviceWindow",
  "serviceDay",
  "stockMovement",
  "orderItem",
  "orderBundle",
  "bundleItem",
  "bundle",
  "order",
  "product",
  "category",
  "inboxClaim",
  "pushSubscription",
  "user",
  "rateLimit",
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
    // The row outlives the truncate: put back whatever a test may have written.
    update: { preorderOpen: true, boothOpen: true, lowStockThreshold: 3, brandName: null, tagline: null, instagram: null },
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

export async function makeBundle(options: {
  name?: string;
  price?: number;
  isActive?: boolean;
  items: { productId: string; quantity: number }[];
}) {
  const bundle = await db.orm.public.Bundle.create({
    name: options.name ?? `Paket Uji ${Math.random().toString(36).slice(2, 8)}`,
    price: options.price ?? 25_000,
    isActive: options.isActive ?? true,
  });

  for (const item of options.items) {
    await db.orm.public.BundleItem.create({ bundleId: bundle.id, ...item });
  }

  return bundle;
}

export async function makeUser(role: UserRole = "KASIR") {
  return await db.orm.public.User.create({
    name: `Uji ${role}`,
    email: `${role.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@uji.test`,
    password: "not-a-real-hash",
    role,
  });
}

/** Far enough ahead to be bookable whatever the cut-off, inside the checkout horizon. */
export const PREORDER_DATE = Temporal.PlainDate.from(todayInJakarta()).add({ days: 10 }).toString();

/** "09.00 - 10.00" as minutes after midnight. */
function rangeMinutes(range: string): { startMinute: number; endMinute: number } {
  const [start, end] = range.split(" - ").map((time) => {
    const [hours, minutes] = time.split(".").map(Number);
    return hours! * 60 + minutes!;
  });
  return { startMinute: start!, endMinute: end! };
}

/**
 * Opens `PREORDER_DATE` (every place) with one time range of `quota` places,
 * written like "09.00 - 10.00", and returns the handover a preorder books it
 * with: what `createOrder` takes as `schedule`.
 */
export async function openPreorderWindow(range: string, quota: number) {
  const { startMinute, endMinute } = rangeMinutes(range);
  const day = await openServiceDay({
    date: PREORDER_DATE,
    locations: ["CAMPUS_B", "MARKET_DAY", "OTHER"],
    windows: [{ startMinute, endMinute, quota }],
  });
  const window = await db.orm.public.ServiceWindow.where({ dayId: day.id, startMinute }).first();
  if (!window) throw new Error(`Time range ${range} not opened`);
  return { location: "MARKET_DAY" as const, detail: null, serviceWindowId: window.id };
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

/** How many places of a time range are taken. */
export async function bookedIn(serviceWindowId: string): Promise<number> {
  const window = await db.orm.public.ServiceWindow.where({ id: serviceWindowId }).first();
  if (!window) throw new Error(`Time range ${serviceWindowId} not found`);
  return window.booked;
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
