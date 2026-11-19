import { prisma as db } from "@/lib/prisma";

/** Why a product's stock moved, as the admin reads it. */
export const STOCK_REASON_LABEL = {
  INITIAL_STOCK: "Stok awal",
  ORDER_CONFIRMED: "Terjual",
  ORDER_CANCELLED: "Pesanan batal, stok kembali",
  MANUAL_ADJUST: "Diubah admin",
  WASTE: "Rusak atau terbuang",
} as const satisfies Record<string, string>;

/** One change to a product's stock, flattened for the page. */
export interface StockHistoryRow {
  id: string;
  /** ISO instant. */
  at: string;
  productName: string;
  /** Positive in, negative out. */
  quantity: number;
  reason: keyof typeof STOCK_REASON_LABEL;
  /** Who did it; null for a customer's own checkout. */
  actorName: string | null;
  orderNumber: string | null;
}

export interface StockHistoryPage {
  rows: StockHistoryRow[];
  total: number;
  page: number;
  pageCount: number;
}

const PAGE_SIZE = 50;

/**
 * Every change to the stock, newest first, from `StockMovement`: what
 * `adjustStock` writes for each sale, cancellation, initial stock and
 * admin correction. Narrowed to one product when `productId` is given, and
 * paginated by fifty.
 */
export async function getStockHistory(
  options: { productId?: string | null; page?: number } = {},
): Promise<StockHistoryPage> {
  let query = db.orm.public.StockMovement;
  if (options.productId) query = query.where({ productId: options.productId });

  const { total } = await query.aggregate((aggregate) => ({ total: aggregate.count() }));
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = Math.trunc(options.page ?? 1);
  const page = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), pageCount) : 1;

  const rows = await query
    .include("product", (product) => product.select("id", "name"))
    .include("actor", (user) => user.select("id", "name"))
    .include("order", (order) => order.select("id", "orderNumber"))
    .orderBy([(row) => row.createdAt.desc(), (row) => row.id.desc()])
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return {
    total,
    page,
    pageCount,
    rows: rows.map((row) => ({
      id: row.id,
      at: row.createdAt.toString(),
      productName: row.product?.name ?? "Menu yang sudah dihapus",
      quantity: row.quantity,
      reason: row.reason as StockHistoryRow["reason"],
      actorName: row.actor?.name ?? null,
      orderNumber: row.order?.orderNumber ?? null,
    })),
  };
}
