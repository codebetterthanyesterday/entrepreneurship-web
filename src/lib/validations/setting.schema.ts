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
  /** When the team answers chats, in minutes after 00.00 WIB. */
  chatOpenMinute: z
    .number()
    .int("Jamnya nggak valid")
    .min(0, "Jamnya nggak valid")
    .max(24 * 60, "Jamnya nggak valid")
    .optional(),
  chatCloseMinute: z
    .number()
    .int("Jamnya nggak valid")
    .min(0, "Jamnya nggak valid")
    .max(24 * 60, "Jamnya nggak valid")
    .optional(),
})
  .superRefine((data, ctx) => {
    if (
      data.chatOpenMinute != null &&
      data.chatCloseMinute != null &&
      data.chatCloseMinute <= data.chatOpenMinute
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["chatCloseMinute"],
        message: "Jam selesainya harus setelah jam mulai",
      });
    }
  });
