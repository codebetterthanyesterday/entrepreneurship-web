import bcrypt from "bcryptjs";
import { prisma as db } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { temporaryPassword } from "@/lib/temp-password";
import type { CreateStaffInput, UpdateStaffInput } from "@/lib/validations/staff.schema";
import type { UserRole } from "@/types/order";

/**
 * The staff accounts, as an admin manages them on Admin → Staf: add one, change
 * its name, email or role, switch it off or back on, and reset its password.
 * Until now this was a script run against the database.
 *
 * Accounts are never deleted. Their names stay on the orders and stock
 * movements they handled; a retired one is switched off instead, and an
 * account switched off or reset is signed out on every device at once
 * (`sessionVersion`, checked on every request by the `jwt` callback in
 * `src/lib/auth.ts`).
 *
 * An admin cannot switch themselves off or change their own role, and the
 * last active admin cannot be removed either way: someone must always be able
 * to sign in and undo a mistake.
 */

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

/** An account and the password to hand over, shown once and never stored in the clear. */
export interface IssuedPassword {
  account: StaffAccount;
  password: string;
}

function view(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
}): StaffAccount {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
}

const ROLE_ORDER: Record<string, number> = { ADMIN: 0, KASIR: 1, DAPUR: 2 };

/** Active accounts first, then by role and name. */
export async function listStaff(): Promise<StaffAccount[]> {
  const users = await db.orm.public.User.all();
  return users
    .map(view)
    .sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
        a.name.localeCompare(b.name, "id"),
    );
}

async function emailTaken(email: string, exceptId?: string): Promise<boolean> {
  const found = await db.orm.public.User.where({ email }).first();
  return found !== null && found !== undefined && found.id !== exceptId;
}

export async function createStaff(input: CreateStaffInput): Promise<IssuedPassword> {
  if (await emailTaken(input.email)) {
    throw new ValidationError("Email itu udah dipakai akun lain", "email");
  }
  const password = temporaryPassword();
  const user = await db.orm.public.User.create({
    name: input.name,
    email: input.email,
    password: await bcrypt.hash(password, 10),
    role: input.role,
    isActive: true,
    mustChangePassword: true,
  });
  return { account: view(user), password };
}

async function activeAdminCount(): Promise<number> {
  const admins = await db.orm.public.User.where({ role: "ADMIN", isActive: true }).all();
  return admins.length;
}

export async function updateStaff(actorId: string, input: UpdateStaffInput): Promise<StaffAccount> {
  const user = await db.orm.public.User.where({ id: input.id }).first();
  if (!user) throw new NotFoundError("Akunnya nggak ketemu");

  if (user.id === actorId && (input.role !== user.role || !input.isActive)) {
    throw new ForbiddenError("Peran dan status akunmu sendiri nggak bisa kamu ubah di sini");
  }
  const losesAdmin = user.role === "ADMIN" && user.isActive && (input.role !== "ADMIN" || !input.isActive);
  if (losesAdmin && (await activeAdminCount()) <= 1) {
    throw new ValidationError("Harus ada minimal satu admin yang aktif", "role");
  }
  if (input.email !== user.email && (await emailTaken(input.email, user.id))) {
    throw new ValidationError("Email itu udah dipakai akun lain", "email");
  }

  // Switching an account off ends its sessions; so does a new role, which
  // also changes what its screens may do.
  const endsSessions = (user.isActive && !input.isActive) || input.role !== user.role;
  await db.orm.public.User.where({ id: user.id }).update({
    name: input.name,
    email: input.email,
    role: input.role,
    isActive: input.isActive,
    ...(endsSessions ? { sessionVersion: user.sessionVersion + 1 } : {}),
  });
  return view({ ...user, ...input });
}

/** A new temporary password, to be changed at the next sign-in; every session of the account ends. */
export async function resetStaffPassword(actorId: string, id: string): Promise<IssuedPassword> {
  const user = await db.orm.public.User.where({ id }).first();
  if (!user) throw new NotFoundError("Akunnya nggak ketemu");
  if (user.id === actorId) {
    throw new ForbiddenError("Password-mu sendiri diganti dari halaman Akun");
  }
  const password = temporaryPassword();
  await db.orm.public.User.where({ id }).update({
    password: await bcrypt.hash(password, 10),
    mustChangePassword: true,
    sessionVersion: user.sessionVersion + 1,
  });
  return { account: view({ ...user, mustChangePassword: true }), password };
}

/**
 * What a signed-in session is still allowed to be: its current role and name,
 * or `null` when the account is gone, switched off, or reset since the session
 * began. Read on every request by the `jwt` callback.
 */
export async function currentSessionAccount(
  id: string,
  sessionVersion: number,
): Promise<{ role: UserRole; name: string } | null> {
  const user = await db.orm.public.User.where({ id }).first();
  if (!user || !user.isActive || user.sessionVersion !== sessionVersion) return null;
  return { role: user.role as UserRole, name: user.name };
}
