import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ user: null as { id: string; role: string } | null }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/session", async () => {
  const { ForbiddenError, UnauthorizedError } = await import("@/lib/errors");
  return {
    requireRole: async (...roles: string[]) => {
      if (!session.user) throw new UnauthorizedError();
      if (!roles.includes(session.user.role)) throw new ForbiddenError();
      return session.user;
    },
  };
});

const { createCategoryAction, deleteCategoryAction, renameCategoryAction } = await import(
  "@/actions/category.actions"
);
const { prisma: db } = await import("@/lib/prisma");
const { closeDatabase, makeUser, resetDatabase } = await import("@/lib/services/__tests__/helpers/test-db");

beforeEach(async () => {
  await resetDatabase();
  session.user = null;
});

afterAll(async () => {
  await closeDatabase();
});

describe("category actions", () => {
  it("are an admin's alone", async () => {
    const kasir = await makeUser("KASIR");
    session.user = { id: kasir.id, role: "KASIR" };
    const kopi = await db.orm.public.Category.create({ name: "Kopi", sortOrder: 0 });

    expect((await createCategoryAction({ name: "Snack" })).ok).toBe(false);
    expect((await renameCategoryAction({ id: kopi.id, name: "Teh" })).ok).toBe(false);
    expect((await deleteCategoryAction(kopi.id)).ok).toBe(false);
    expect((await db.orm.public.Category.all()).map((c) => c.name)).toEqual(["Kopi"]);
  });

  it("trims the name, and points a refusal at the name field", async () => {
    const admin = await makeUser("ADMIN");
    session.user = { id: admin.id, role: "ADMIN" };

    const created = await createCategoryAction({ name: "  Kopi  " });
    expect(created.ok && created.data.name).toBe("Kopi");

    const again = await createCategoryAction({ name: "kopi" });
    expect(again).toMatchObject({ ok: false, field: "name" });
    const empty = await createCategoryAction({ name: "   " });
    expect(empty).toMatchObject({ ok: false, field: "name" });
  });
});
