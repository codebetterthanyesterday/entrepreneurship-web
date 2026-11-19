"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { toActionError, type ActionResult } from "@/lib/action-result";
import { createStaffSchema, staffIdSchema, updateStaffSchema } from "@/lib/validations/staff.schema";
import {
  createStaff,
  resetStaffPassword,
  updateStaff,
  type IssuedPassword,
  type StaffAccount,
} from "@/lib/services/staff.service";

/*
 * Admin → Staf. Admin only. The acting admin's id always comes from the
 * session, never from the request, so the self-guards in the service cannot
 * be talked around.
 */

export async function createStaffAction(input: unknown): Promise<ActionResult<IssuedPassword>> {
  try {
    await requireRole("ADMIN");
    const issued = await createStaff(createStaffSchema.parse(input));
    revalidatePath("/admin/staf");
    return { ok: true, data: issued };
  } catch (error) {
    return toActionError(error, "createStaffAction");
  }
}

export async function updateStaffAction(input: unknown): Promise<ActionResult<StaffAccount>> {
  try {
    const admin = await requireRole("ADMIN");
    const account = await updateStaff(admin.id, updateStaffSchema.parse(input));
    revalidatePath("/admin/staf");
    return { ok: true, data: account };
  } catch (error) {
    return toActionError(error, "updateStaffAction");
  }
}

export async function resetStaffPasswordAction(id: unknown): Promise<ActionResult<IssuedPassword>> {
  try {
    const admin = await requireRole("ADMIN");
    const issued = await resetStaffPassword(admin.id, staffIdSchema.parse(id));
    revalidatePath("/admin/staf");
    return { ok: true, data: issued };
  } catch (error) {
    return toActionError(error, "resetStaffPasswordAction");
  }
}
