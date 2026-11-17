"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { toActionError, type ActionResult } from "@/lib/action-result";
import { updateSettingsSchema } from "@/lib/validations/setting.schema";
import { updateSettings } from "@/lib/services/setting.service";

/**
 * Store settings gate the public preorder form and the checkout, so
 * the settings page, the catalogue, and the checkout all need re-rendering.
 */
function revalidateStore() {
  revalidatePath("/admin/pengaturan");
  revalidatePath("/admin/menu");
  revalidatePath("/");
  revalidatePath("/checkout");
  // The colour-mood switch lives in the public layout, so every customer page
  // has to be re-asked — not only the three above.
  revalidatePath("/", "layout");
}

/** Empty strings from an optional text input are stored as NULL. */
function emptyToNull<T extends Record<string, unknown>>(input: T): T {
  const cleaned: Record<string, unknown> = { ...input };
  for (const key of ["adminWhatsapp"]) {
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
