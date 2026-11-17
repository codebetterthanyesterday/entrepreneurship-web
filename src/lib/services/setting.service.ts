import type { z } from "zod";
import { prisma as db } from "@/lib/prisma";
import type { updateSettingsSchema } from "@/lib/validations/setting.schema";

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export async function getSettings() {
  const setting = await db.orm.public.StoreSetting.where({ id: 1 }).first();
  if (setting) return setting;

  return await db.orm.public.StoreSetting.create({
    id: 1,
    preorderOpen: true,
    boothOpen: true,
    lowStockThreshold: 3,
  });
}

export async function updateSettings(input: UpdateSettingsInput) {
  // Make sure the singleton row exists before updating it.
  await getSettings();

  return await db.orm.public.StoreSetting.where({ id: 1 }).update(input);
}
