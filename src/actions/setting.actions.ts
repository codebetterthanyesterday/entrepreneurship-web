"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { toActionError, type ActionResult } from "@/lib/action-result";
import {
  deletePickupSlotSchema,
  updateSettingsSchema,
  upsertPickupSlotSchema,
} from "@/lib/validations/setting.schema";
import {
  deletePickupSlot,
  updateSettings,
  upsertPickupSlot,
} from "@/lib/services/setting.service";

/**
 * Store settings gate the public preorder form and the pickup slot picker, so
 * the settings page, the catalogue, and the checkout all need re-rendering.
 */
function revalidateStore() {
  revalidatePath("/admin/pengaturan");
  revalidatePath("/admin/menu");
  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/checkout");
}

/** Empty strings from an optional text input are stored as NULL. */
function emptyToNull<T extends Record<string, unknown>>(input: T): T {
  const cleaned: Record<string, unknown> = { ...input };
  for (const key of ["qrisImageUrl", "adminWhatsapp"]) {
    if (cleaned[key] === "") cleaned[key] = null;
  }
  return cleaned as T;
}

export async function updateSettingsAction(
  input: unknown,
): Promise<ActionResult<{ updated: true }>> {
  try {
    await requireRole("ADMIN");
    const data = emptyToNull(updateSettingsSchema.parse(input));

    await updateSettings(data);

    revalidateStore();
    return { ok: true, data: { updated: true } };
  } catch (error) {
    return toActionError(error, "updateSettingsAction");
  }
}

export async function upsertPickupSlotAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole("ADMIN");
    const data = upsertPickupSlotSchema.parse(input);

    const slot = await upsertPickupSlot(data);

    revalidateStore();
    return { ok: true, data: { id: slot.id } };
  } catch (error) {
    return toActionError(error, "upsertPickupSlotAction");
  }
}

export async function deletePickupSlotAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole("ADMIN");
    const data = deletePickupSlotSchema.parse({ id });

    await deletePickupSlot(data.id);

    revalidateStore();
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return toActionError(error, "deletePickupSlotAction");
  }
}
