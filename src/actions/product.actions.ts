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

const idSchema = z.string().min(1, "Menunya nggak ketemu");

/** The admin menu list and the public catalogue both read product rows. */
function revalidateCatalog() {
  revalidatePath("/admin/menu");
  // The catalogue lives at /menu, and the profile page at "/" prints a short
  // menu of its own from the same products, so a price or stock change touches
  // both.
  revalidatePath("/");
  revalidatePath("/menu");
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
