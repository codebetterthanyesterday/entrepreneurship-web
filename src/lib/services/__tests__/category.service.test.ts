import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma as db } from "@/lib/prisma";
import {
  createCategory,
  deleteCategory,
  listCategoriesWithCounts,
  moveCategory,
  renameCategory,
} from "@/lib/services/category.service";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { closeDatabase, makeProduct, resetDatabase } from "@/lib/services/__tests__/helpers/test-db";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

const names = async () => (await listCategoriesWithCounts()).map((category) => category.name);

async function inCategory(categoryId: string) {
  const product = await makeProduct();
  await db.orm.public.Product.where({ id: product.id }).update({ categoryId });
  return product;
}

describe("adding and renaming", () => {
  it("adds a category at the end of the order", async () => {
    await createCategory({ name: "Kopi" });
    await createCategory({ name: "Snack" });

    expect(await names()).toEqual(["Kopi", "Snack"]);
  });

  it("refuses a name already taken, whatever its case", async () => {
    const kopi = await createCategory({ name: "Kopi" });
    const snack = await createCategory({ name: "Snack" });

    await expect(createCategory({ name: "kopi" })).rejects.toThrow(ValidationError);
    await expect(renameCategory({ id: snack.id, name: "KOPI" })).rejects.toThrow(ValidationError);
    // Its own name in another case is fine.
    await renameCategory({ id: kopi.id, name: "KOPI" });
    expect(await names()).toEqual(["KOPI", "Snack"]);
  });

  it("keeps the menu items of a renamed category in it", async () => {
    const kopi = await createCategory({ name: "Kopi" });
    const product = await inCategory(kopi.id);

    await renameCategory({ id: kopi.id, name: "Kopi Susu" });

    const [row] = await listCategoriesWithCounts();
    expect(row).toMatchObject({ name: "Kopi Susu", products: 1 });
    expect((await db.orm.public.Product.where({ id: product.id }).first())!.categoryId).toBe(kopi.id);
  });
});

describe("ordering", () => {
  it("moves a category one place, and does nothing past either end", async () => {
    const kopi = await createCategory({ name: "Kopi" });
    await createCategory({ name: "Teh" });
    const snack = await createCategory({ name: "Snack" });

    await moveCategory(snack.id, -1);
    expect(await names()).toEqual(["Kopi", "Snack", "Teh"]);
    await moveCategory(kopi.id, -1);
    await moveCategory(kopi.id, 1);
    expect(await names()).toEqual(["Snack", "Kopi", "Teh"]);
  });

  it("gives categories that shared a position one each, so a move always shows", async () => {
    for (const name of ["Kopi", "Teh", "Snack"]) {
      await db.orm.public.Category.create({ name, sortOrder: 0 });
    }
    const [, second] = await listCategoriesWithCounts();

    await moveCategory(second!.id, -1);

    expect((await names())[0]).toBe(second!.name);
  });
});

describe("deleting", () => {
  it("never deletes menu items: they move to no category and stay on sale", async () => {
    const kopi = await createCategory({ name: "Kopi" });
    const a = await inCategory(kopi.id);
    const b = await inCategory(kopi.id);

    expect(await deleteCategory(kopi.id)).toEqual({ moved: 2 });

    expect(await names()).toEqual([]);
    for (const product of [a, b]) {
      const row = (await db.orm.public.Product.where({ id: product.id }).first())!;
      expect(row.categoryId).toBeNull();
      expect(row.isActive).toBe(true);
    }
  });

  it("answers not found for a category already gone", async () => {
    const kopi = await createCategory({ name: "Kopi" });
    await deleteCategory(kopi.id);

    await expect(deleteCategory(kopi.id)).rejects.toThrow(NotFoundError);
    await expect(moveCategory(kopi.id, 1)).rejects.toThrow(NotFoundError);
  });
});
