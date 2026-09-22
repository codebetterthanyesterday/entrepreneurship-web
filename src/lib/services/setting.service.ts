import type { z } from "zod";
import { prisma as db } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
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

export async function getPickupSlots() {
  return await db.orm.public.PickupSlot.orderBy((s) => s.sortOrder.asc()).all();
}

export async function upsertPickupSlot(input: {
  id?: string | null;
  label: string;
  quota: number;
  sortOrder?: number | null;
  isActive?: boolean;
}) {
  if (input.id) {
    const existing = await db.orm.public.PickupSlot.where({ id: input.id }).first();
    if (!existing) throw new NotFoundError("Slot pengambilannya nggak ketemu");

    // The database enforces booked <= quota, so a quota cut below the places
    // already taken is refused here with a message the admin can act on rather
    // than being left to surface as a constraint violation.
    if (input.quota < existing.booked) {
      throw new ValidationError(
        `Slot ini udah dipesan ${existing.booked} orang, kuotanya nggak bisa dikecilin di bawah itu`,
        "quota",
      );
    }

    const updated = await db.orm.public.PickupSlot.where({ id: input.id }).update({
      label: input.label,
      quota: input.quota,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      isActive: input.isActive ?? existing.isActive,
    });
    if (!updated) throw new NotFoundError("Slot pengambilannya nggak ketemu");

    return updated;
  }

  const slots = await getPickupSlots();
  const nextSortOrder =
    input.sortOrder ?? slots.reduce((max, slot) => Math.max(max, slot.sortOrder), 0) + 1;

  return await db.orm.public.PickupSlot.create({
    label: input.label,
    quota: input.quota,
    sortOrder: nextSortOrder,
    isActive: input.isActive ?? true,
  });
}

export async function deletePickupSlot(id: string) {
  const slot = await db.orm.public.PickupSlot.where({ id }).first();
  if (!slot) throw new NotFoundError("Slot pengambilannya nggak ketemu");

  // Order.pickupSlot stores the label as a snapshot, not a foreign key, so a
  // slot still referenced by an order is hidden rather than removed.
  const usage = await db.orm.public.Order.where({ pickupSlot: slot.label }).aggregate(
    (aggregate) => ({ total: aggregate.count() }),
  );

  if (usage.total > 0) {
    throw new ValidationError(
      `Slot "${slot.label}" udah dipakai ${usage.total} pesanan, jadi nggak bisa dihapus. Kecilin kuotanya aja ya.`,
    );
  }

  await db.orm.public.PickupSlot.where({ id }).delete();
}
