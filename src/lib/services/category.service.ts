import { prisma as db } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { TxClient } from "@/lib/db-types";
import type { CreateCategoryInput, RenameCategoryInput } from "@/lib/validations/category.schema";

/** One category as Admin → Menu → Kategori lists it. */
export interface CategoryWithCount {
  id: string;
  name: string;
  /** Menu items in it, hidden ones included. */
  products: number;
}

const NOT_FOUND = "Kategorinya nggak ketemu";

/**
 * Every category in the admin's order (the order the catalogue, the till and
 * the menu filters show them), with how many menu items each holds.
 */
export async function listCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const [categories, products] = await Promise.all([
    db.orm.public.Category.orderBy((c) => c.sortOrder.asc()).all(),
    db.orm.public.Product.select("categoryId").all(),
  ]);
  const counts = new Map<string, number>();
  for (const product of products) {
    if (product.categoryId) counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
  }
  return [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "id"))
    .map((category) => ({ id: category.id, name: category.name, products: counts.get(category.id) ?? 0 }));
}

/** The categories in display order, inside a transaction. */
async function ordered(tx: TxClient) {
  const rows = await tx.orm.public.Category.orderBy((c) => c.sortOrder.asc()).all();
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "id"));
}

/** Names are unique whatever the case: "Kopi" and "kopi" would read as one shelf. */
function assertNameFree(rows: { id: string; name: string }[], name: string, except?: string) {
  const taken = rows.find((row) => row.id !== except && row.name.toLocaleLowerCase("id") === name.toLocaleLowerCase("id"));
  if (taken) throw new ValidationError(`Kategori "${taken.name}" udah ada`, "name");
}

/** Adds a category at the end of the order. */
export async function createCategory(input: CreateCategoryInput) {
  return await db.transaction(async (tx: TxClient) => {
    const rows = await ordered(tx);
    assertNameFree(rows, input.name);
    const last = rows.at(-1)?.sortOrder ?? -1;
    return await tx.orm.public.Category.create({ name: input.name, sortOrder: last + 1 });
  });
}

/** Renames a category; its menu items stay in it. */
export async function renameCategory(input: RenameCategoryInput) {
  return await db.transaction(async (tx: TxClient) => {
    const rows = await ordered(tx);
    if (!rows.some((row) => row.id === input.id)) throw new NotFoundError(NOT_FOUND);
    assertNameFree(rows, input.name, input.id);
    const updated = await tx.orm.public.Category.where({ id: input.id }).update({ name: input.name });
    if (!updated) throw new NotFoundError(NOT_FOUND);
    return updated;
  });
}

/**
 * Moves a category one place earlier or later. The whole order is written
 * back as 0, 1, 2, …, so categories that shared a position (the seed's) get
 * one each. At either end it does nothing.
 */
export async function moveCategory(id: string, by: -1 | 1): Promise<void> {
  await db.transaction(async (tx: TxClient) => {
    const rows = await ordered(tx);
    const from = rows.findIndex((row) => row.id === id);
    if (from === -1) throw new NotFoundError(NOT_FOUND);
    const to = from + by;
    if (to < 0 || to >= rows.length) return;
    [rows[from], rows[to]] = [rows[to]!, rows[from]!];
    for (const [index, row] of rows.entries()) {
      if (row.sortOrder !== index) {
        await tx.orm.public.Category.where({ id: row.id }).update({ sortOrder: index });
      }
    }
  });
}

/**
 * Deletes a category. Its menu items are not deleted: they move to "Tanpa
 * kategori" (the catalogue's "Lainnya" shelf) and stay on sale. Returns how
 * many moved.
 */
export async function deleteCategory(id: string): Promise<{ moved: number }> {
  return await db.transaction(async (tx: TxClient) => {
    const category = await tx.orm.public.Category.where({ id }).first();
    if (!category) throw new NotFoundError(NOT_FOUND);
    const moved = await tx.orm.public.Product.where({ categoryId: id }).updateAll({ categoryId: null });
    await tx.orm.public.Category.where({ id }).delete();
    return { moved: moved.length };
  });
}
