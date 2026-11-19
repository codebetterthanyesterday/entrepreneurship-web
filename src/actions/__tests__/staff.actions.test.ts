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

const { createStaffAction, resetStaffPasswordAction, updateStaffAction } = await import("@/actions/staff.actions");
const { prisma: db } = await import("@/lib/prisma");
const { closeDatabase, makeUser, resetDatabase } = await import("@/lib/services/__tests__/helpers/test-db");

beforeEach(async () => {
  await resetDatabase();
  session.user = null;
});

afterAll(async () => {
  await closeDatabase();
});

describe("staff actions", () => {
  it("are an admin's alone", async () => {
    const kasir = await makeUser("KASIR");
    session.user = { id: kasir.id, role: "KASIR" };

    expect((await createStaffAction({ name: "Rani", email: "rani@x.test", role: "ADMIN" })).ok).toBe(false);
    expect((await resetStaffPasswordAction(kasir.id)).ok).toBe(false);
    expect(await db.orm.public.User.where({ email: "rani@x.test" }).first()).toBeNull();
  });

  it("stores the email lower-cased and trimmed, as sign-in looks it up", async () => {
    const admin = await makeUser("ADMIN");
    session.user = { id: admin.id, role: "ADMIN" };

    const result = await createStaffAction({ name: "Rani", email: "  Rani@Bunnye.Test ", role: "KASIR" });

    expect(result.ok && result.data.account.email).toBe("rani@bunnye.test");
  });

  it("takes the acting admin from the session, so the self-guard cannot be dodged", async () => {
    const admin = await makeUser("ADMIN");
    await makeUser("ADMIN");
    session.user = { id: admin.id, role: "ADMIN" };

    const result = await updateStaffAction({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: "KASIR",
      isActive: true,
      actorId: "someone-else",
    });

    expect(result.ok).toBe(false);
    expect((await db.orm.public.User.where({ id: admin.id }).first())!.role).toBe("ADMIN");
  });
});
