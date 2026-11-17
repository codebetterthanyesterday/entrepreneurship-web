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
