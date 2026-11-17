"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { toActionError, type ActionResult } from "@/lib/action-result";
import { bundleSchema } from "@/lib/validations/bundle.schema";
import {
  createBundle,
  deleteBundle,
  toggleBundleActive,
  updateBundle,
} from "@/lib/services/bundle.service";

const idSchema = z.string().min(1, "Paketnya nggak ketemu");

/** The admin's menu page and the customer pages that offer pakets. */
function revalidateBundles() {
  revalidatePath("/admin/menu");
  revalidatePath("/");
  revalidatePath("/keranjang");
  revalidatePath("/checkout");
}

export async function createBundleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole("ADMIN");
    const data = bundleSchema.parse(input);

    const bundle = await createBundle(data);

    revalidateBundles();
    return { ok: true, data: { id: bundle.id } };
  } catch (error) {
    return toActionError(error, "createBundleAction");
  }
}

export async function updateBundleAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole("ADMIN");
    const bundleId = idSchema.parse(id);
    const data = bundleSchema.parse(input);

    await updateBundle(bundleId, data);

    revalidateBundles();
    return { ok: true, data: { id: bundleId } };
  } catch (error) {
    return toActionError(error, "updateBundleAction");
  }
}

export async function toggleBundleActiveAction(
  id: string,
): Promise<ActionResult<{ id: string; isActive: boolean }>> {
  try {
    await requireRole("ADMIN");
    const bundleId = idSchema.parse(id);

    const bundle = await toggleBundleActive(bundleId);

    revalidateBundles();
    return { ok: true, data: { id: bundleId, isActive: bundle.isActive } };
  } catch (error) {
    return toActionError(error, "toggleBundleActiveAction");
  }
}

export async function deleteBundleAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole("ADMIN");
    const bundleId = idSchema.parse(id);

    await deleteBundle(bundleId);

    revalidateBundles();
    return { ok: true, data: { id: bundleId } };
  } catch (error) {
    return toActionError(error, "deleteBundleAction");
  }
}
