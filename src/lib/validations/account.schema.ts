import { z } from "zod";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password sekarang harus diisi"),
    newPassword: z
      .string()
      .min(8, "Password barunya minimal 8 karakter")
      // bcrypt only reads the first 72 bytes of a password, so anything longer
      // is silently truncated. Refusing it is honest; accepting it is not.
      .max(72, "Password barunya kepanjangan, maksimal 72 karakter"),
    confirmPassword: z.string().min(1, "Ulangi password barunya"),
  })
  .refine((input) => input.newPassword === input.confirmPassword, {
    message: "Dua password barunya belum sama",
    path: ["confirmPassword"],
  })
  .refine((input) => input.newPassword !== input.currentPassword, {
    message: "Password barunya masih sama dengan yang sekarang",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
