import { z } from "zod";

export const STAFF_ROLES = ["ADMIN", "KASIR", "DAPUR"] as const;

const name = z.string().trim().min(1, "Namanya harus diisi").max(60, "Namanya kepanjangan, maksimal 60 huruf");
// Stored lower-cased and trimmed, as sign-in looks it up.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Format email-nya belum benar")
  .max(120, "Email-nya kepanjangan");
const role = z.enum(STAFF_ROLES, { error: "Pilih perannya dulu" });

export const createStaffSchema = z.object({ name, email, role });

export const updateStaffSchema = z.object({
  id: z.string().min(1, "Akunnya nggak ketemu"),
  name,
  email,
  role,
  isActive: z.boolean(),
});

export const staffIdSchema = z.string().min(1, "Akunnya nggak ketemu");

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
