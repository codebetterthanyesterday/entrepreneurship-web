"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/lib/action-result";
import { requireRole } from "@/lib/session";
import {
  addServiceWindow,
  closeServiceDay,
  deleteServiceWindow,
  openServiceDay,
  setDayLocations,
  setOrderCutoff,
  updateWindowQuota,
} from "@/lib/services/schedule.service";
import {
  addWindowSchema,
  cutoffSchema,
  dayLocationsSchema,
  openServiceDaySchema,
  windowQuotaSchema,
} from "@/lib/validations/schedule.schema";

/**
 * The admin's preorder schedule. Every change here moves what the checkout
 * offers, so the checkout is refreshed along with the settings page.
 */
function revalidateSchedule() {
  revalidatePath("/admin/pengaturan");
  revalidatePath("/checkout");
}

const idSchema = z.string().min(1, "Datanya nggak ketemu");

async function run<T>(context: string, work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    await requireRole("ADMIN");
    const data = await work();
    revalidateSchedule();
    return { ok: true, data };
  } catch (error) {
    return toActionError(error, context);
  }
}

export async function openServiceDayAction(input: unknown) {
  return run("openServiceDayAction", async () => {
    const day = await openServiceDay(openServiceDaySchema.parse(input));
    return { id: day.id };
  });
}

export async function closeServiceDayAction(dayId: unknown) {
  return run("closeServiceDayAction", async () => {
    await closeServiceDay(idSchema.parse(dayId));
    return { closed: true as const };
  });
}

export async function setDayLocationsAction(input: unknown) {
  return run("setDayLocationsAction", async () => {
    const data = dayLocationsSchema.parse(input);
    await setDayLocations(data.dayId, data.locations);
    return { updated: true as const };
  });
}

export async function addServiceWindowAction(input: unknown) {
  return run("addServiceWindowAction", async () => {
    const window = await addServiceWindow(addWindowSchema.parse(input));
    return { id: window.id };
  });
}

export async function updateWindowQuotaAction(input: unknown) {
  return run("updateWindowQuotaAction", async () => {
    const data = windowQuotaSchema.parse(input);
    await updateWindowQuota(data.windowId, data.quota);
    return { updated: true as const };
  });
}

export async function deleteServiceWindowAction(windowId: unknown) {
  return run("deleteServiceWindowAction", async () => {
    await deleteServiceWindow(idSchema.parse(windowId));
    return { deleted: true as const };
  });
}

export async function setOrderCutoffAction(input: unknown) {
  return run("setOrderCutoffAction", async () => {
    const data = cutoffSchema.parse(input);
    await setOrderCutoff(data.orderCutoffMinute);
    return { updated: true as const };
  });
}
