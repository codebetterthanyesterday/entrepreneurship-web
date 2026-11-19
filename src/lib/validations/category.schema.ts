import { z } from "zod";

const name = z
  .string()
  .trim()
  .min(1, "Nama kategorinya harus diisi")
  .max(40, "Nama kategorinya kepanjangan, maksimal 40 huruf");
const id = z.string().min(1, "Kategorinya nggak ketemu");

export const createCategorySchema = z.object({ name });
export const renameCategorySchema = z.object({ id, name });
export const moveCategorySchema = z.object({ id, by: z.union([z.literal(-1), z.literal(1)]) });
export const categoryIdSchema = id;

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type RenameCategoryInput = z.infer<typeof renameCategorySchema>;
