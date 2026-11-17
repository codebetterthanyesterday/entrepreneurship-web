import { z } from "zod";

const bundleItemSchema = z.object({
  productId: z.string().min(1, "Menu isi paketnya nggak valid"),
  quantity: z
    .number()
    .int("Jumlahnya harus angka bulat")
    .min(1, "Tiap isi paket minimal 1 porsi")
    .max(20, "Jumlah isinya kebanyakan nih"),
});

const items = z
  .array(bundleItemSchema)
  .min(2, "Paket isinya minimal 2 menu")
  .max(10, "Isi paketnya kebanyakan, maksimal 10 menu")
  .refine(
    (list) => new Set(list.map((item) => item.productId)).size === list.length,
    "Ada menu yang dimasukin dua kali. Naikin jumlahnya aja ya",
  );

export const bundleSchema = z.object({
  name: z.string().trim().min(2, "Nama paketnya belum diisi minimal 2 huruf ya").max(60),
  description: z.string().trim().max(200, "Deskripsinya kepanjangan").optional().nullable(),
  price: z.number().int("Harganya harus angka bulat").positive("Harganya harus lebih dari nol"),
  imageUrl: z.string().trim().url("Alamat gambarnya nggak valid").optional().nullable().or(z.literal("")),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  items,
});

export type BundleInput = z.infer<typeof bundleSchema>;

export const bundleOrderLineSchema = z.object({
  bundleId: z.string().min(1, "Paketnya nggak valid"),
  quantity: z
    .number()
    .int("Jumlahnya harus angka bulat")
    .min(1, "Jumlah tiap paket minimal 1")
    .max(99, "Jumlahnya kebanyakan nih"),
});
