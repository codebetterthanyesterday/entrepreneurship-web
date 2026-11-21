import { z } from "zod";
import { bundleOrderLineSchema } from "./bundle.schema";
import { HANDOVER_DETAIL_MAX, HANDOVER_LOCATIONS, OTHER_DETAIL_MIN } from "@/lib/schedule";

export const orderLineSchema = z.object({
  productId: z.string().min(1, "Menunya nggak valid"),
  quantity: z
    .number()
    .int("Jumlahnya harus angka bulat")
    .min(1, "Jumlah tiap menu minimal 1")
    .max(99, "Jumlahnya kebanyakan nih"),
});

/**
 * A basket holds loose products, pakets, or both — but not nothing. The
 * emptiness check therefore looks at the two lists together; each on its own
 * may be empty.
 */
const EMPTY_BASKET = "Pesanannya masih kosong, pilih menu dulu ya";

function basketNotEmpty(
  data: { items: readonly unknown[]; bundles?: readonly unknown[] },
  ctx: z.RefinementCtx,
): void {
  if (data.items.length === 0 && (data.bundles?.length ?? 0) === 0) {
    ctx.addIssue({ code: "custom", path: ["items"], message: EMPTY_BASKET });
  }
}

const orderBaseSchema = z.object({
  items: z.array(orderLineSchema),
  bundles: z.array(bundleOrderLineSchema).max(20, "Paketnya kebanyakan nih").optional(),
  customerName: z.string().trim().min(2, "Isi nama dulu ya"),
  notes: z.string().trim().max(200, "Catatannya kepanjangan, maksimal 200 huruf").optional(),
});

/**
 * What the customer's preorder form sends — and nothing more.
 *
 * There is deliberately no `channel`, no `paymentStatus`, and no price or total
 * here. A preorder is always PREORDER and always UNPAID, and every rupiah is
 * recomputed by `createOrder` from the product rows; letting any of those
 * arrive from the browser would let a customer mark their own order paid.
 */
export const createPreorderSchema = orderBaseSchema
  .extend({
    customerPhone: z
      .string()
      .trim()
      .regex(/^0\d{8,13}$/, "Nomor WhatsApp-nya belum betul"),
    handoverLocation: z.enum(HANDOVER_LOCATIONS, { message: "Pilih lokasi serah terimanya dulu ya" }),
    handoverDetail: z
      .string()
      .trim()
      .max(HANDOVER_DETAIL_MAX, "Detail lokasinya kepanjangan")
      .optional()
      .nullable(),
    serviceWindowId: z
      .string({ message: "Pilih tanggal dan jamnya dulu ya" })
      .min(1, "Pilih tanggal dan jamnya dulu ya"),
    // Preorders are paid by QRIS only: no cash on pickup or delivery.
    paymentMethod: z.literal("QRIS", { message: "Preorder dibayar lewat QRIS ya" }),
  })
  .superRefine(basketNotEmpty)
  .superRefine((data, ctx) => {
    // "Lainnya" is a place we have to find, so it has to be written down.
    if (data.handoverLocation === "OTHER" && (data.handoverDetail?.length ?? 0) < OTHER_DETAIL_MIN) {
      ctx.addIssue({
        code: "custom",
        path: ["handoverDetail"],
        message: "Tulis lokasinya lengkap ya, biar kami bisa cek jangkauannya",
      });
    }
  });

export type CreatePreorderInput = z.infer<typeof createPreorderSchema>;

/**
 * What the cashier's on-the-spot screen sends: the basket, how the customer is
 * paying, and — for cash — how much they handed over.
 *
 * Like the preorder schema, there is no `channel`, `paymentStatus`, price or
 * total here, and no `handledById`: the action sets the first two, the session
 * supplies the third, and `createOrder` recomputes every rupiah. Unknown keys
 * are stripped, so a request that sends them anyway has them ignored.
 *
 * A walk-in is not asked for a name at the till; the action fills a stand-in
 * when none is given.
 */
export const createOnsiteOrderSchema = z
  .object({
    items: orderBaseSchema.shape.items,
    bundles: orderBaseSchema.shape.bundles,
    notes: orderBaseSchema.shape.notes,
    customerName: z.string().trim().max(60, "Namanya kepanjangan").optional(),
    paymentMethod: z.enum(["CASH", "QRIS"], { message: "Pilih cara bayarnya ya" }),
    cashReceived: z
      .number({ message: "Isi uang yang diterima dulu ya" })
      .int("Uangnya harus angka bulat")
      .min(0, "Uangnya nggak boleh minus")
      .max(100_000_000, "Nominalnya kebanyakan nih")
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    basketNotEmpty(data, ctx);
    if (data.paymentMethod === "CASH" && (data.cashReceived === undefined || data.cashReceived === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["cashReceived"],
        message: "Isi uang yang diterima dulu ya",
      });
    }
  });

export type CreateOnsiteOrderInput = z.infer<typeof createOnsiteOrderSchema>;

export const transitionStatusSchema = z.object({
  orderId: z.string().min(1, "Pesanannya nggak ketemu"),
  to: z.enum(["CONFIRMED", "IN_QUEUE", "IN_PROGRESS", "READY", "DONE", "CANCELLED"], {
    message: "Status tujuannya nggak valid",
  }),
});

export const markAsPaidSchema = z.object({
  orderId: z.string().min(1, "Pesanannya nggak ketemu"),
  cashReceived: z
    .number()
    .int("Uangnya harus angka bulat")
    .min(0, "Uangnya nggak boleh minus")
    .nullable()
    .optional(),
});

export const cancelOrderSchema = z.object({
  orderId: z.string().min(1, "Pesanannya nggak ketemu"),
  reason: z.string().max(200, "Alasannya kepanjangan").nullable().optional(),
});

/**
 * What a cashier or admin sends to correct an order (`updateOrderDetails`):
 * the name, the WhatsApp number, and optionally a new handover. Prices,
 * items and payment are not here: they are not corrected, the order is
 * cancelled and placed again.
 */
export const updateOrderDetailsSchema = z
  .object({
    orderId: z.string().min(1, "Pesanannya nggak ketemu"),
    customerName: z
      .string()
      .trim()
      .min(2, "Isi nama dulu ya")
      .max(60, "Namanya kepanjangan, maksimal 60 huruf"),
    // Empty means none; a walk-in may have no number.
    customerPhone: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .pipe(z.string().regex(/^0\d{8,13}$/, "Nomor WhatsApp-nya belum betul").nullable()),
    schedule: z
      .object({
        handoverLocation: z.enum(HANDOVER_LOCATIONS, { message: "Pilih lokasi serah terimanya dulu ya" }),
        handoverDetail: z
          .string()
          .trim()
          .max(HANDOVER_DETAIL_MAX, "Detail lokasinya kepanjangan")
          .transform((value) => (value === "" ? null : value))
          .nullable(),
        serviceWindowId: z
          .string({ message: "Pilih tanggal dan jamnya dulu ya" })
          .min(1, "Pilih tanggal dan jamnya dulu ya"),
      })
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.schedule?.handoverLocation === "OTHER" && (data.schedule.handoverDetail?.length ?? 0) < OTHER_DETAIL_MIN) {
      ctx.addIssue({
        code: "custom",
        path: ["handoverDetail"],
        message: "Tulis lokasinya lengkap ya, biar kami bisa cek jangkauannya",
      });
    }
  });
