"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { toActionError, type ActionResult } from "@/lib/action-result";
import {
  adjustStockSchema,
  createProductSchema,
  updateProductSchema,
} from "@/lib/validations/product.schema";
import {
  createProduct,
  deleteProduct,
  toggleActive,
  updateProduct,
} from "@/lib/services/product.service";
import { adjustStock } from "@/lib/services/stock.service";
import { moveProductImage, removeProductImage } from "@/lib/services/product-image.service";
import { revalidateProductPhotos } from "@/lib/revalidate-product";

const idSchema = z.string().min(1, "Menunya nggak ketemu");

/** The admin menu list and the public catalogue both read product rows. */
function revalidateCatalog() {
  revalidatePath("/admin/menu");
  // The catalogue is the home page.
  revalidatePath("/");
}

const photoSchema = z.object({
  productId: idSchema,
  imageId: z.string().uuid("Fotonya nggak ketemu"),
});

/** Removes one of a product's photos for good. */
export async function removeProductImageAction(input: unknown): Promise<ActionResult<{ removed: true }>> {
  try {
    await requireRole("ADMIN");
    const data = photoSchema.parse(input);
    await removeProductImage(data.productId, data.imageId);
    revalidateProductPhotos();
    return { ok: true, data: { removed: true } };
  } catch (error) {
    return toActionError(error, "removeProductImageAction");
  }
}

/** Moves a photo one place earlier or later; the first is the cover. */
export async function moveProductImageAction(input: unknown): Promise<ActionResult<{ moved: true }>> {
  try {
    await requireRole("ADMIN");
    const data = photoSchema.extend({ by: z.union([z.literal(-1), z.literal(1)]) }).parse(input);
    await moveProductImage(data.productId, data.imageId, data.by);
    revalidateProductPhotos();
    return { ok: true, data: { moved: true } };
  } catch (error) {
    return toActionError(error, "moveProductImageAction");
  }
}

export async function createProductAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole("ADMIN");
    const data = createProductSchema.parse(input);

    const product = await createProduct(data, actor.id);

    revalidateCatalog();
    return { ok: true, data: { id: product.id } };
  } catch (error) {
    return toActionError(error, "createProductAction");
  }
}

export async function updateProductAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole("ADMIN");
    const productId = idSchema.parse(id);
    const data = updateProductSchema.parse(input);

    await updateProduct(productId, data, actor.id);

    revalidateCatalog();
    return { ok: true, data: { id: productId } };
  } catch (error) {
    return toActionError(error, "updateProductAction");
  }
}

export async function toggleProductActiveAction(
  id: string,
): Promise<ActionResult<{ id: string; isActive: boolean }>> {
  try {
    await requireRole("ADMIN");
    const productId = idSchema.parse(id);

    const product = await toggleActive(productId);

    revalidateCatalog();
    return { ok: true, data: { id: productId, isActive: product.isActive } };
  } catch (error) {
    return toActionError(error, "toggleProductActiveAction");
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole("ADMIN");
    const productId = idSchema.parse(id);

    await deleteProduct(productId);

    revalidateCatalog();
    return { ok: true, data: { id: productId } };
  } catch (error) {
    return toActionError(error, "deleteProductAction");
  }
}

export async function adjustStockAction(
  input: unknown,
): Promise<ActionResult<{ id: string; stock: number }>> {
  try {
    const actor = await requireRole("ADMIN");
    const data = adjustStockSchema.parse(input);

    const product = await adjustStock({
      productId: data.productId,
      delta: data.delta,
      reason: data.reason,
      actorId: actor.id,
    });

    revalidateCatalog();
    return { ok: true, data: { id: product.id, stock: product.stock } };
  } catch (error) {
    return toActionError(error, "adjustStockAction");
  }
}
