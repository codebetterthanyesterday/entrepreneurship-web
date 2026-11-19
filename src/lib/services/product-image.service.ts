import { prisma as db } from "@/lib/prisma";
import type { TxClient } from "@/lib/db-types";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { imageIdOf, imagePath } from "@/lib/stored-image";
import { checkedImage } from "@/lib/services/image.service";

/**
 * A menu item's photos: none or more, in order.
 *
 * The bytes are a `StoredImage` of kind PRODUCT, served publicly from
 * `/gambar/<id>`; `ProductImage` holds the order. The first photo is the
 * cover, and it is copied to `Product.imageUrl`, which every screen already
 * reads (the catalogue, the cart, the till, the dashboard, a paket's items).
 * Every change here re-copies it in the same transaction, so the two never
 * disagree.
 *
 * A product with no uploaded photo keeps an `imageUrl` that was not one of
 * ours (an address pasted in before uploads existed); once it has photos,
 * they win.
 */

/** Enough to show a product from a few sides without bloating the database. */
export const MAX_PRODUCT_IMAGES = 6;

export type { ProductImageView } from "@/lib/queries/product-image.query";
import type { ProductImageView } from "@/lib/queries/product-image.query";

async function ordered(tx: TxClient, productId: string) {
  const rows = await tx.orm.public.ProductImage.where({ productId }).all();
  return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.imageId.localeCompare(b.imageId));
}

/** Writes 0, 1, 2… back in the given order, and the first photo as the cover. */
async function settle(
  tx: TxClient,
  productId: string,
  rows: { id: string; imageId: string; sortOrder: number }[],
): Promise<void> {
  for (const [index, row] of rows.entries()) {
    if (row.sortOrder !== index) {
      await tx.orm.public.ProductImage.where({ id: row.id }).update({ sortOrder: index });
    }
  }

  const product = await tx.orm.public.Product.where({ id: productId }).first();
  if (!product) return;
  const cover = rows[0] ? imagePath(rows[0].imageId) : null;
  // No photos left: an address that was ours goes; a pasted one stays.
  const next = cover ?? (imageIdOf(product.imageUrl) ? null : (product.imageUrl ?? null));
  if (next !== (product.imageUrl ?? null)) {
    await tx.orm.public.Product.where({ id: productId }).update({ imageUrl: next });
  }
}

async function requireProduct(tx: TxClient, productId: string) {
  const product = await tx.orm.public.Product.where({ id: productId }).first();
  if (!product) throw new NotFoundError("Menunya nggak ketemu");
  return product;
}

/** Adds a photo at the end. The first one a product gets becomes its cover. */
export async function addProductImage(productId: string, bytes: Uint8Array): Promise<ProductImageView> {
  const mimeType = checkedImage(bytes);
  return await db.transaction(async (tx) => {
    await requireProduct(tx, productId);
    const rows = await ordered(tx, productId);
    if (rows.length >= MAX_PRODUCT_IMAGES) {
      throw new ValidationError(
        `Satu menu paling banyak ${MAX_PRODUCT_IMAGES} foto. Hapus salah satu dulu ya`,
        "file",
      );
    }
    const image = await tx.orm.public.StoredImage.create({
      kind: "PRODUCT",
      mimeType,
      data: bytes,
      byteSize: bytes.length,
    });
    const row = await tx.orm.public.ProductImage.create({
      productId,
      imageId: image.id,
      sortOrder: rows.length,
    });
    await settle(tx, productId, [...rows, row]);
    return { id: image.id, url: imagePath(image.id) };
  });
}

/** Removes a photo for good, its bytes included. The next one becomes the cover. */
export async function removeProductImage(productId: string, imageId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await requireProduct(tx, productId);
    const rows = await ordered(tx, productId);
    if (!rows.some((row) => row.imageId === imageId)) throw new NotFoundError("Fotonya nggak ketemu");
    // The ProductImage row goes with it (ON DELETE CASCADE).
    await tx.orm.public.StoredImage.where({ id: imageId }).delete();
    await settle(
      tx,
      productId,
      rows.filter((row) => row.imageId !== imageId),
    );
  });
}

/** Moves a photo one place earlier (-1) or later (1). Moving one to the front makes it the cover. */
export async function moveProductImage(productId: string, imageId: string, by: -1 | 1): Promise<void> {
  await db.transaction(async (tx) => {
    await requireProduct(tx, productId);
    const rows = await ordered(tx, productId);
    const from = rows.findIndex((row) => row.imageId === imageId);
    if (from === -1) throw new NotFoundError("Fotonya nggak ketemu");
    const to = from + by;
    if (to < 0 || to >= rows.length) return;
    [rows[from], rows[to]] = [rows[to]!, rows[from]!];
    await settle(tx, productId, rows);
  });
}
