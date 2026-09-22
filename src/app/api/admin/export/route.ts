import { Temporal } from "@js-temporal/polyfill";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { csvAttachmentHeader, toCsv, type CsvColumn } from "@/lib/csv";
import {
  getOrderItemsForExport,
  getOrdersForExport,
  getProductRecapForExport,
  type OrderExportRow,
  type OrderItemExportRow,
  type ProductExportRow,
} from "@/lib/queries/report.query";
import { requireRole } from "@/lib/session";

/** The report is dated in the timezone the event ran in, not the server's. */
const EVENT_TIME_ZONE = "Asia/Jakarta";

const CHANNEL_LABEL: Readonly<Record<string, string>> = {
  PREORDER: "Preorder",
  ONSITE: "Di tempat",
};

const STATUS_LABEL: Readonly<Record<string, string>> = {
  CONFIRMED: "Belum diambil",
  IN_QUEUE: "Antrian dapur",
  IN_PROGRESS: "Lagi diracik",
  READY: "Siap diserahkan",
  DONE: "Selesai",
  CANCELLED: "Dibatalkan",
};

const PAYMENT_STATUS_LABEL: Readonly<Record<string, string>> = {
  PAID: "Lunas",
  UNPAID: "Belum bayar",
};

const PREP_TYPE_LABEL: Readonly<Record<string, string>> = {
  READY_TO_SERVE: "Siap ambil",
  NEEDS_PREP: "Diracik dadakan",
};

/**
 * Enum columns are written in Indonesian, the way every screen shows them.
 *
 * The reader of this file is a lecturer with a spreadsheet, not someone who
 * knows the schema — `IN_PROGRESS` means nothing to them. A value the map has
 * never heard of falls through as itself rather than as an empty cell, so a
 * status added to the schema later shows up in the export instead of vanishing
 * from it.
 */
function label(map: Readonly<Record<string, string>>, value: string): string {
  return map[value] ?? value;
}

const ORDER_COLUMNS: readonly CsvColumn<OrderExportRow>[] = [
  { header: "Nomor Pesanan", value: (row) => row.orderNumber },
  { header: "Kanal", value: (row) => label(CHANNEL_LABEL, row.channel) },
  { header: "Status", value: (row) => label(STATUS_LABEL, row.status) },
  { header: "Nama Pelanggan", value: (row) => row.customerName },
  { header: "Nomor WhatsApp", value: (row) => row.customerPhone },
  { header: "Slot Ambil", value: (row) => row.pickupSlot },
  { header: "Metode Bayar", value: (row) => row.paymentMethod },
  { header: "Status Bayar", value: (row) => label(PAYMENT_STATUS_LABEL, row.paymentStatus) },
  { header: "Total", value: (row) => row.totalAmount },
  { header: "Waktu Dibuat", value: (row) => row.createdAt },
];

const ITEM_COLUMNS: readonly CsvColumn<OrderItemExportRow>[] = [
  { header: "Nomor Pesanan", value: (row) => row.orderNumber },
  { header: "Nama Menu", value: (row) => row.productName },
  { header: "Jumlah", value: (row) => row.quantity },
  { header: "Harga Saat Pesan", value: (row) => row.priceAtOrder },
  { header: "Subtotal", value: (row) => row.subtotal },
];

const PRODUCT_COLUMNS: readonly CsvColumn<ProductExportRow>[] = [
  { header: "Nama Menu", value: (row) => row.name },
  { header: "Kategori", value: (row) => row.categoryName },
  { header: "Jenis Racik", value: (row) => label(PREP_TYPE_LABEL, row.prepType) },
  { header: "Harga", value: (row) => row.price },
  { header: "Terjual", value: (row) => row.quantitySold },
  { header: "Sisa Stok", value: (row) => row.stock },
  { header: "Total Pemasukan", value: (row) => row.revenue },
];

/** The three things an admin can pull, keyed by the `type` query parameter. */
const EXPORTS = {
  orders: {
    filePrefix: "pesanan",
    build: async () => toCsv(ORDER_COLUMNS, await getOrdersForExport()),
  },
  items: {
    filePrefix: "rincian-item",
    build: async () => toCsv(ITEM_COLUMNS, await getOrderItemsForExport()),
  },
  products: {
    filePrefix: "rekap-menu",
    build: async () => toCsv(PRODUCT_COLUMNS, await getProductRecapForExport()),
  },
} as const;

export type ExportType = keyof typeof EXPORTS;

export const EXPORT_TYPES = Object.keys(EXPORTS) as readonly ExportType[];

function isExportType(value: string | null): value is ExportType {
  return value !== null && value in EXPORTS;
}

/**
 * Serves one of the three report attachments as a CSV download.
 *
 * The proxy's matcher skips `/api/*` entirely, so `requireRole` here is the
 * only thing standing between an anonymous request and every customer's name,
 * phone number and order history. It runs before a single row is read.
 */
export async function GET(request: Request): Promise<Response> {
  // An export is a snapshot of a moving event; a cached one would quietly hand
  // out yesterday's figures.
  const headers = { "Cache-Control": "no-store" };

  try {
    await requireRole("ADMIN");

    const type = new URL(request.url).searchParams.get("type");

    if (!isExportType(type)) {
      return Response.json(
        { error: `Jenis ekspornya nggak dikenal. Pilih salah satu: ${EXPORT_TYPES.join(", ")}.` },
        { status: 400, headers },
      );
    }

    const { filePrefix, build } = EXPORTS[type];
    const today = Temporal.Now.zonedDateTimeISO(EVENT_TIME_ZONE).toPlainDate().toString();

    return new Response(await build(), {
      headers: {
        ...headers,
        // `charset=utf-8` alongside the BOM: the two together are what make the
        // file open correctly whether the reader's tool trusts the header or
        // sniffs the bytes.
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": csvAttachmentHeader(filePrefix, today),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: error.message }, { status: 401, headers });
    }

    if (error instanceof ForbiddenError) {
      return Response.json({ error: error.message }, { status: 403, headers });
    }

    console.error("[GET /api/admin/export]", error);
    return Response.json({ error: "Ada yang error nih, coba lagi ya" }, { status: 500, headers });
  }
}
