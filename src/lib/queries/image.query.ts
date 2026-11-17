import { prisma as db } from "@/lib/prisma";

/** One stored image, bytes included, for `/gambar/<id>`. */
export async function findStoredImage(id: string) {
  return await db.orm.public.StoredImage.where({ id }).first();
}
