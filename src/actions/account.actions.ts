"use server";

import { requireAuth } from "@/lib/session";
import { toActionError, type ActionResult } from "@/lib/action-result";
import { changePasswordSchema } from "@/lib/validations/account.schema";
import { changePassword } from "@/lib/services/account.service";

/**
 * Changes the signed-in user's own password.
 *
 * `requireAuth()` supplies the id, and the payload is never asked for one. That
 * is the whole security model here: if the id came from the request body, any
 * signed-in member of the crew could change an admin's password by editing one
 * field, and the three e-mail addresses are guessable from the pattern.
 *
 * Every staff role may do this — a cashier and a kitchen hand own their accounts
 * as much as an admin does — so there is no `requireRole` here on purpose.
 */
export async function changePasswordAction(
  input: unknown,
): Promise<ActionResult<{ changed: true }>> {
  try {
    const user = await requireAuth();
    const data = changePasswordSchema.parse(input);

    const result = await changePassword({ ...data, userId: user.id });

    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error, "changePasswordAction");
  }
}
