import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(2, "Nama menunya belum diisi minimal 2 huruf ya"),
  price: z.number().int().positive("Harganya harus lebih dari nol"),
  stock: z.number().int().min(0, "Stok nggak boleh kurang dari nol"),
  prepType: z.enum(["READY_TO_SERVE", "NEEDS_PREP"], {
    message: "Tipe penyiapan menu harus dipilih",
  }),
  categoryId: z.string().min(1, "Kategori belum dipilih").optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = z.object({
  name: z.string().min(2, "Nama menunya belum diisi minimal 2 huruf ya").optional(),
  price: z.number().int().positive("Harganya harus lebih dari nol").optional(),
  stock: z.number().int().min(0, "Stok nggak boleh kurang dari nol").optional(),
  prepType: z.enum(["READY_TO_SERVE", "NEEDS_PREP"]).optional(),
  categoryId: z.string().min(1, "Kategori tidak valid").optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const adjustStockSchema = z.object({
  productId: z.string().min(1, "ID produk tidak valid"),
  delta: z.number().int("Delta stok harus berupa angka bulat"),
  reason: z.enum(["INITIAL_STOCK", "ORDER_CONFIRMED", "ORDER_CANCELLED", "MANUAL_ADJUST", "WASTE"], {
    message: "Alasan perubahan stok harus diisi",
  }),
});
