import { z } from "zod";

export const updateSettingsSchema = z.object({
  preorderOpen: z.boolean().optional(),
  boothOpen: z.boolean().optional(),
  accentChoiceEnabled: z.boolean().optional(),
  lowStockThreshold: z
    .number()
    .int("Ambang stoknya harus angka bulat")
    .min(0, "Ambang stoknya nggak boleh minus")
    .max(999, "Ambang stoknya kegedean")
    .optional(),
  qrisImageUrl: z
    .union([z.string().url("Link gambar QRIS-nya belum benar"), z.literal("")])
    .nullable()
    .optional(),
  adminWhatsapp: z
    .union([
      z
        .string()
        .regex(/^[0-9+][0-9\s-]{7,19}$/, "Nomor WhatsApp-nya belum benar, contoh: 081234567890"),
      z.literal(""),
    ])
    .nullable()
    .optional(),
});

export const upsertPickupSlotSchema = z.object({
  id: z.string().min(1).optional().nullable(),
  label: z.string().min(2, "Label slotnya belum diisi, contoh: 09.00 - 10.00"),
  quota: z
    .number()
    .int("Kuotanya harus angka bulat")
    .min(1, "Kuotanya minimal 1")
    .max(999, "Kuotanya kegedean"),
  sortOrder: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const deletePickupSlotSchema = z.object({
  id: z.string().min(1, "Slot pengambilannya nggak ketemu"),
});
