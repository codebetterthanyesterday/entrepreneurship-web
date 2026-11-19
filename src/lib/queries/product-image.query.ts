import { prisma as db } from "@/lib/prisma";
import { imagePath } from "@/lib/stored-image";

export interface ProductImageView {
  /** The stored image's id: what the admin's buttons send back. */
  id: string;
  url: string;
}

/** Every product's photos, in order, for the screens that show more than the cover. */
export async function findProductImages(
  productIds: readonly string[],
): Promise<Map<string, ProductImageView[]>> {
  const byProduct = new Map<string, ProductImageView[]>(productIds.map((id) => [id, []]));
  if (productIds.length === 0) return byProduct;
  const rows = await db.orm.public.ProductImage.where((row) => row.productId.in([...productIds])).all();
  rows.sort((a, b) => a.sortOrder - b.sortOrder || a.imageId.localeCompare(b.imageId));
  for (const row of rows) {
    byProduct.get(row.productId)?.push({ id: row.imageId, url: imagePath(row.imageId) });
  }
  return byProduct;
}
