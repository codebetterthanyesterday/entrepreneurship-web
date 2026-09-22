"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { StaleContentError } from "@/lib/errors";
import { toActionError, type ActionResult } from "@/lib/action-result";
import {
  moveSiteListItemSchema,
  siteListItemIdSchema,
  updateSiteTextSchema,
  upsertSiteListItemSchema,
} from "@/lib/validations/site.schema";
import {
  deleteSiteListItem,
  moveSiteListItem,
  resetSiteText,
  saveSiteText,
  upsertSiteListItem,
} from "@/lib/services/site.service";
import { isSiteTextKey, type SiteTextKey } from "@/lib/site-content";

/**
 * Every action here starts with `requireRole("ADMIN")`.
 *
 * The edit controls are only drawn for an admin, and the "edit mode" switch is
 * only a cookie — anyone can set it, and anyone can call a server action
 * directly. The role check on the server is therefore the whole of the
 * protection, not a second opinion about it. Nothing in the payload is trusted
 * to say who the caller is.
 */
async function requireAdmin() {
  return await requireRole("ADMIN");
}

/**
 * The profile lives at "/" and its footer is in the public layout, so a saved
 * block can change any page under it. `"layout"` covers that whole subtree in
 * one call rather than listing the customer pages and forgetting one later.
 */
function revalidatePublicSite() {
  revalidatePath("/", "layout");
}

export type SiteTextSaved = {
  key: SiteTextKey;
  value: string;
  version: number;
};

/**
 * A failed save that lost a race carries the text that won it, so the editor can
 * show the admin what is actually stored instead of just refusing.
 */
export type SiteTextResult =
  | ActionResult<SiteTextSaved>
  | { ok: false; error: string; current: string };

export async function updateSiteTextAction(input: unknown): Promise<SiteTextResult> {
  try {
    await requireAdmin();
    const data = updateSiteTextSchema.parse(input);

    const saved = await saveSiteText(data);

    revalidatePublicSite();
    return { ok: true, data: saved };
  } catch (error) {
    if (error instanceof StaleContentError) {
      return { ok: false, error: error.message, current: error.current };
    }

    return toActionError(error, "updateSiteTextAction");
  }
}

export async function resetSiteTextAction(input: unknown): Promise<ActionResult<SiteTextSaved>> {
  try {
    await requireAdmin();

    const key = (input as { key?: unknown })?.key;
    if (typeof key !== "string" || !isSiteTextKey(key)) {
      return { ok: false, error: "Blok teksnya nggak dikenal" };
    }

    const reset = await resetSiteText(key);

    revalidatePublicSite();
    return { ok: true, data: reset };
  } catch (error) {
    return toActionError(error, "resetSiteTextAction");
  }
}

export async function upsertSiteListItemAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
    const data = upsertSiteListItemSchema.parse(input);

    const item = await upsertSiteListItem(data);

    revalidatePublicSite();
    return { ok: true, data: { id: item.id } };
  } catch (error) {
    return toActionError(error, "upsertSiteListItemAction");
  }
}

export async function deleteSiteListItemAction(
  input: unknown,
): Promise<ActionResult<{ deleted: true }>> {
  try {
    await requireAdmin();
    const { id } = siteListItemIdSchema.parse(input);

    await deleteSiteListItem(id);

    revalidatePublicSite();
    return { ok: true, data: { deleted: true } };
  } catch (error) {
    return toActionError(error, "deleteSiteListItemAction");
  }
}

export async function moveSiteListItemAction(
  input: unknown,
): Promise<ActionResult<{ moved: boolean }>> {
  try {
    await requireAdmin();
    const data = moveSiteListItemSchema.parse(input);

    const result = await moveSiteListItem(data);

    revalidatePublicSite();
    return { ok: true, data: { moved: result.moved } };
  } catch (error) {
    return toActionError(error, "moveSiteListItemAction");
  }
}
