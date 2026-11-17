import type { z } from "zod";
import { prisma as db } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { windowLabel } from "@/lib/schedule";
import type {
  addWindowSchema,
  openServiceDaySchema,
} from "@/lib/validations/schedule.schema";

/**
 * The staff side of the preorder schedule: which dates are open, which
 * handover locations each one serves, and its time ranges with their quotas.
 *
 * A date that has never been opened, or has been closed, takes no preorders.
 * Closing keeps the date's rows, so the orders already booked on it keep their
 * place; only new orders are turned away.
 */

type Window = { startMinute: number; endMinute: number; quota: number };

function overlaps(a: { startMinute: number; endMinute: number }, b: { startMinute: number; endMinute: number }) {
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

function assertNoOverlap(windows: readonly Window[], existing: readonly Window[] = []) {
  const all = [...existing];
  for (const window of windows) {
    const clash = all.find((other) => overlaps(window, other));
    if (clash) {
      throw new ValidationError(
        `Jam ${windowLabel(window.startMinute, window.endMinute)} bentrok dengan ${windowLabel(clash.startMinute, clash.endMinute)}`,
        "startMinute",
      );
    }
    all.push(window);
  }
}

/** Opens a date (creating it, or switching it back on) with the locations it serves. */
export async function openServiceDay(input: z.infer<typeof openServiceDaySchema>) {
  return await db.transaction(async (tx) => {
    const existing = await tx.orm.public.ServiceDay.where({ date: input.date })
      .include("windows")
      .first();

    const day = existing
      ? await tx.orm.public.ServiceDay.where({ id: existing.id }).update({
          isOpen: true,
          locations: [...input.locations],
        })
      : await tx.orm.public.ServiceDay.create({
          date: input.date,
          isOpen: true,
          locations: [...input.locations],
        });

    const current = existing?.windows ?? [];
    // Ranges already on the date are kept as they are; only new ones are added.
    const fresh = input.windows.filter(
      (window) => !current.some((other) => other.startMinute === window.startMinute),
    );
    assertNoOverlap(fresh, current);
    for (const window of fresh) {
      await tx.orm.public.ServiceWindow.create({ dayId: day!.id, ...window, booked: 0 });
    }

    return day!;
  });
}

/** Stops taking preorders for a date. Orders already on it are untouched. */
export async function closeServiceDay(dayId: string) {
  const day = await db.orm.public.ServiceDay.where({ id: dayId }).first();
  if (!day) throw new NotFoundError("Tanggalnya nggak ketemu");
  await db.orm.public.ServiceDay.where({ id: dayId }).update({ isOpen: false });
}

export async function setDayLocations(dayId: string, locations: readonly string[]) {
  const day = await db.orm.public.ServiceDay.where({ id: dayId }).first();
  if (!day) throw new NotFoundError("Tanggalnya nggak ketemu");
  await db.orm.public.ServiceDay.where({ id: dayId }).update({ locations: [...locations] });
}

export async function addServiceWindow(input: z.infer<typeof addWindowSchema>) {
  const { dayId, ...window } = input;
  return await db.transaction(async (tx) => {
    const day = await tx.orm.public.ServiceDay.where({ id: dayId }).include("windows").first();
    if (!day) throw new NotFoundError("Tanggalnya nggak ketemu");
    assertNoOverlap([window], day.windows);
    return await tx.orm.public.ServiceWindow.create({ dayId, ...window, booked: 0 });
  });
}

/**
 * Changes a range's quota. It can never go below the places already booked:
 * the check sits inside the UPDATE, so a checkout landing at the same moment
 * cannot slip between reading and writing.
 */
export async function updateWindowQuota(windowId: string, quota: number) {
  await db.transaction(async (tx) => {
    const plan = db.raw
      .sql`UPDATE "public"."serviceWindow" SET "quota" = ${quota} WHERE "id" = ${windowId} AND "booked" <= ${quota}`
      .affectedCount()
      .build();
    const { affectedRows } = await tx.execute(plan);

    if (affectedRows === 0) {
      const window = await tx.orm.public.ServiceWindow.where({ id: windowId }).first();
      if (!window) throw new NotFoundError("Rentang jamnya nggak ketemu");
      throw new ValidationError(
        `Udah ada ${window.booked} pesanan di jam ini, kuotanya nggak bisa di bawah itu`,
        "quota",
      );
    }
  });
}

/** Removes a range nobody has booked. One with orders on it has to stay. */
export async function deleteServiceWindow(windowId: string) {
  return await db.transaction(async (tx) => {
    const window = await tx.orm.public.ServiceWindow.where({ id: windowId }).first();
    if (!window) throw new NotFoundError("Rentang jamnya nggak ketemu");

    const used = await tx.orm.public.Order.where({ serviceWindowId: windowId }).first();
    if (used || window.booked > 0) {
      throw new ValidationError(
        "Jam ini udah ada pesanannya, jadi nggak bisa dihapus. Kecilkan kuotanya atau tutup tanggalnya aja.",
      );
    }
    await tx.orm.public.ServiceWindow.where({ id: windowId }).delete();
  });
}

export async function setOrderCutoff(orderCutoffMinute: number) {
  const settings = await db.orm.public.StoreSetting.where({ id: 1 }).first();
  if (settings) {
    await db.orm.public.StoreSetting.where({ id: 1 }).update({ orderCutoffMinute });
  } else {
    await db.orm.public.StoreSetting.create({ id: 1, orderCutoffMinute });
  }
}
