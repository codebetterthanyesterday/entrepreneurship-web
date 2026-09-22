import bcrypt from "bcryptjs";
import { prisma as db } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { initialPasswordFor } from "@/lib/initial-password";
import type { ChangePasswordInput } from "@/lib/validations/account.schema";

export interface ChangePasswordArgs extends ChangePasswordInput {
  /**
   * Whose password to change.
   *
   * Comes from the session, never from the request body — see the note in
   * `account.actions.ts`. The service takes it as an argument so it stays
   * testable, and the action is the only thing allowed to supply it.
   */
  userId: string;
}

/**
 * Changes a staff member's own password.
 *
 * Knowing the current one is required. Without that check, anybody who got hold
 * of an unlocked phone with a session on it could lock the owner out of their own
 * account mid-service.
 */
export async function changePassword({
  userId,
  currentPassword,
  newPassword,
}: ChangePasswordArgs) {
  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user) throw new NotFoundError("Akunnya nggak ketemu");

  // A retired account cannot be revived by whoever still holds its session: the
  // JWT outlives the deactivation by up to twelve hours.
  if (!user.isActive) throw new ForbiddenError("Akun ini sudah dinonaktifkan");

  const matches = await bcrypt.compare(currentPassword, user.password);
  if (!matches) {
    throw new ValidationError("Password sekarang nggak cocok", "currentPassword");
  }

  // The shared starting password is known to the whole team, so "changing" to it
  // would change nothing that matters.
  if (newPassword === initialPasswordFor(user.name)) {
    throw new ValidationError(
      "Itu password awal yang dibagikan ke semua orang. Pilih yang lain ya.",
      "newPassword",
    );
  }

  await db.orm.public.User.where({ id: user.id }).update({
    password: await bcrypt.hash(newPassword, 10),
    mustChangePassword: false,
  });

  return { changed: true as const };
}

/**
 * Whether this account is still on the password the script handed out.
 *
 * Read from the database rather than carried in the session: the session is a
 * JWT that lives for twelve hours, and a notice that stayed up for the rest of
 * the day after somebody had already dealt with it would train them to ignore it.
 */
export async function needsPasswordChange(userId: string): Promise<boolean> {
  const user = await db.orm.public.User.where({ id: userId }).first();

  return user?.mustChangePassword ?? false;
}
