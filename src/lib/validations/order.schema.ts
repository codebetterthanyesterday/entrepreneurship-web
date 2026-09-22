import { z } from "zod";

export const orderLineSchema = z.object({
  productId: z.string().min(1, "Menunya nggak valid"),
  quantity: z
    .number()
    .int("Jumlahnya harus angka bulat")
    .min(1, "Jumlah tiap menu minimal 1")
    .max(99, "Jumlahnya kebanyakan nih"),
});

const orderBaseSchema = z.object({
  items: z.array(orderLineSchema).min(1, "Pesanannya masih kosong, pilih menu dulu ya"),
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
export const createPreorderSchema = orderBaseSchema.extend({
  customerPhone: z
    .string()
    .trim()
    .regex(/^0\d{8,13}$/, "Nomor WhatsApp-nya belum betul"),
  pickupSlot: z.string().trim().min(1, "Pilih jam ambil dulu ya"),
  paymentMethod: z.enum(["CASH", "QRIS"], { message: "Pilih cara bayarnya ya" }),
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
