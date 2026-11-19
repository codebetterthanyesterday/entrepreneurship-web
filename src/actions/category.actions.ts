"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { toActionError, type ActionResult } from "@/lib/action-result";
import {
  categoryIdSchema,
  createCategorySchema,
  moveCategorySchema,
  renameCategorySchema,
} from "@/lib/validations/category.schema";
import { createCategory, deleteCategory, moveCategory, renameCategory } from "@/lib/services/category.service";
import { revalidateProductPhotos } from "@/lib/revalidate-product";

/**
 * Categories are the catalogue's shelves, the till's tabs and the admin's
 * menu filters: every page that shows a product changes with them.
 */
function revalidateCategories() {
  revalidateProductPhotos();
  revalidatePath("/admin/menu/kategori");
}

export async function createCategoryAction(input: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    await requireRole("ADMIN");
    const category = await createCategory(createCategorySchema.parse(input));
    revalidateCategories();
    return { ok: true, data: { id: category.id, name: category.name } };
  } catch (error) {
    return toActionError(error, "createCategoryAction");
  }
}

export async function renameCategoryAction(input: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    await requireRole("ADMIN");
    const category = await renameCategory(renameCategorySchema.parse(input));
    revalidateCategories();
    return { ok: true, data: { id: category.id, name: category.name } };
  } catch (error) {
    return toActionError(error, "renameCategoryAction");
  }
}

export async function moveCategoryAction(input: unknown): Promise<ActionResult<{ moved: true }>> {
  try {
    await requireRole("ADMIN");
    const data = moveCategorySchema.parse(input);
    await moveCategory(data.id, data.by);
    revalidateCategories();
    return { ok: true, data: { moved: true } };
  } catch (error) {
    return toActionError(error, "moveCategoryAction");
  }
}

export async function deleteCategoryAction(id: unknown): Promise<ActionResult<{ moved: number }>> {
  try {
    await requireRole("ADMIN");
    const result = await deleteCategory(categoryIdSchema.parse(id));
    revalidateCategories();
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error, "deleteCategoryAction");
  }
}
