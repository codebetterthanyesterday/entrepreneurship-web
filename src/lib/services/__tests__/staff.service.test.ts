import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma as db } from "@/lib/prisma";
import {
  createStaff,
  currentSessionAccount,
  listStaff,
  resetStaffPassword,
  updateStaff,
} from "@/lib/services/staff.service";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { closeDatabase, makeUser, resetDatabase } from "@/lib/services/__tests__/helpers/test-db";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

const reload = async (id: string) => (await db.orm.public.User.where({ id }).first())!;

describe("adding staff", () => {
  it("creates the account with a temporary password that works once and must be changed", async () => {
    const { account, password } = await createStaff({ name: "Rani", email: "rani@bunnye.test", role: "KASIR" });

    expect(password).toMatch(/^[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}$/);
    const user = await reload(account.id);
    expect(await bcrypt.compare(password, user.password)).toBe(true);
    expect(user.mustChangePassword).toBe(true);
    expect(user.isActive).toBe(true);
  });

  it("refuses an email another account already uses", async () => {
    await createStaff({ name: "Rani", email: "rani@bunnye.test", role: "KASIR" });

    await expect(createStaff({ name: "Rani 2", email: "rani@bunnye.test", role: "DAPUR" })).rejects.toThrow(
      ValidationError,
    );
  });

  it("lists active accounts first, then by role", async () => {
    const admin = await makeUser("ADMIN");
    const kasir = await makeUser("KASIR");
    const gone = await makeUser("DAPUR");
    await updateStaff(admin.id, { id: gone.id, name: gone.name, email: gone.email, role: "DAPUR", isActive: false });

    expect((await listStaff()).map((account) => account.id)).toEqual([admin.id, kasir.id, gone.id]);
  });
});

describe("changing an account", () => {
  it("switching it off ends its sessions everywhere", async () => {
    const admin = await makeUser("ADMIN");
    const kasir = await makeUser("KASIR");
    expect(await currentSessionAccount(kasir.id, 0)).not.toBeNull();

    await updateStaff(admin.id, { id: kasir.id, name: kasir.name, email: kasir.email, role: "KASIR", isActive: false });

    expect(await currentSessionAccount(kasir.id, 0)).toBeNull();
    // Back on, it still needs a fresh sign-in: the old session is gone for good.
    await updateStaff(admin.id, { id: kasir.id, name: kasir.name, email: kasir.email, role: "KASIR", isActive: true });
    expect(await currentSessionAccount(kasir.id, 0)).toBeNull();
    expect(await currentSessionAccount(kasir.id, (await reload(kasir.id)).sessionVersion)).not.toBeNull();
  });

  it("a new name keeps the session, and shows in it", async () => {
    const admin = await makeUser("ADMIN");
    const kasir = await makeUser("KASIR");

    await updateStaff(admin.id, { id: kasir.id, name: "Kasir Baru", email: kasir.email, role: "KASIR", isActive: true });

    expect(await currentSessionAccount(kasir.id, 0)).toEqual({ role: "KASIR", name: "Kasir Baru" });
  });

  it("will not let an admin switch themselves off or change their own role", async () => {
    const admin = await makeUser("ADMIN");
    await makeUser("ADMIN");

    await expect(
      updateStaff(admin.id, { id: admin.id, name: admin.name, email: admin.email, role: "KASIR", isActive: true }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      updateStaff(admin.id, { id: admin.id, name: admin.name, email: admin.email, role: "ADMIN", isActive: false }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("keeps at least one active admin", async () => {
    const admin = await makeUser("ADMIN");
    const other = await makeUser("ADMIN");
    await updateStaff(admin.id, { id: other.id, name: other.name, email: other.email, role: "ADMIN", isActive: false });

    // `admin` is now the last one; another admin acting on them is not possible,
    // so check through a third account promoted to do it.
    const third = await makeUser("ADMIN");
    await updateStaff(third.id, { id: admin.id, name: admin.name, email: admin.email, role: "KASIR", isActive: true });
    await expect(
      updateStaff(admin.id, { id: third.id, name: third.name, email: third.email, role: "KASIR", isActive: true }),
    ).rejects.toThrow(/minimal satu admin/);
  });
});

describe("resetting a password", () => {
  it("issues a new temporary one, retires the old, and ends every session", async () => {
    const admin = await makeUser("ADMIN");
    const { account, password: first } = await createStaff({ name: "Bagas", email: "bagas@bunnye.test", role: "DAPUR" });

    const { password } = await resetStaffPassword(admin.id, account.id);

    const user = await reload(account.id);
    expect(await bcrypt.compare(password, user.password)).toBe(true);
    expect(await bcrypt.compare(first, user.password)).toBe(false);
    expect(user.mustChangePassword).toBe(true);
    expect(await currentSessionAccount(account.id, 0)).toBeNull();
  });

  it("sends an admin to Akun for their own password", async () => {
    const admin = await makeUser("ADMIN");

    await expect(resetStaffPassword(admin.id, admin.id)).rejects.toThrow(ForbiddenError);
  });
});
