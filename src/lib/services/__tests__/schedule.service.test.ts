import { Temporal } from "@js-temporal/polyfill";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma as db } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";
import {
  cancelOrder,
  confirmHandoverLocation,
  createOrder,
  transitionStatus,
} from "@/lib/services/order.service";
import {
  addServiceWindow,
  closeServiceDay,
  deleteServiceWindow,
  openServiceDay,
  updateWindowQuota,
} from "@/lib/services/schedule.service";
import { getBookableSchedule } from "@/lib/queries/schedule.query";
import { todayInJakarta, type HandoverLocation } from "@/lib/schedule";
import { closeDatabase, makeProduct, makeUser, resetDatabase } from "./helpers/test-db";

/** Ten days ahead: inside the checkout's horizon, its cut-off far off. */
const DATE = Temporal.PlainDate.from(todayInJakarta()).add({ days: 10 }).toString();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

async function openDay(options: { date?: string; quota?: number; locations?: HandoverLocation[] } = {}) {
  const day = await openServiceDay({
    date: options.date ?? DATE,
    locations: options.locations ?? ["CAMPUS_B", "MARKET_DAY", "OTHER"],
    windows: [{ startMinute: 660, endMinute: 720, quota: options.quota ?? 2 }],
  });
  const window = await db.orm.public.ServiceWindow.where({ dayId: day.id }).first();
  return { day, window: window! };
}

async function preorder(
  serviceWindowId: string,
  location: HandoverLocation = "CAMPUS_B",
  detail: string | null = null,
) {
  const product = await makeProduct({ stock: 10 });
  return await createOrder({
    channel: "PREORDER",
    paymentStatus: "UNPAID",
    customerName: "Rani",
    customerPhone: "081234561234",
    paymentMethod: "CASH",
    schedule: { location, detail, serviceWindowId },
    items: [{ productId: product.id, quantity: 1 }],
  });
}

const windowOf = async (id: string) => (await db.orm.public.ServiceWindow.where({ id }).first())!;

describe("booking a time range on a service date", () => {
  it("takes one place and records the date, the range and the place on the order", async () => {
    const { window } = await openDay();
    const order = await preorder(window.id, "CAMPUS_B", "Kantin Lt 2");

    expect(order).toMatchObject({
      serviceDate: DATE,
      pickupSlot: "11.00 - 12.00",
      handoverLocation: "CAMPUS_B",
      handoverDetail: "Kantin Lt 2",
      serviceWindowId: window.id,
    });
    expect((await windowOf(window.id)).booked).toBe(1);
  });

  it("refuses the range once its quota is taken", async () => {
    const { window } = await openDay({ quota: 1 });
    await preorder(window.id);

    await expect(preorder(window.id)).rejects.toThrow(/udah penuh/);
  });

  it("lets only one of two customers take the last place at the same moment", async () => {
    const { window } = await openDay({ quota: 1 });
    const results = await Promise.allSettled([preorder(window.id), preorder(window.id)]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await windowOf(window.id)).booked).toBe(1);
  });

  it("refuses a place the date does not serve", async () => {
    const { window } = await openDay({ locations: ["MARKET_DAY"] });
    await expect(preorder(window.id, "CAMPUS_C")).rejects.toThrow(/nggak melayani/);
  });

  it("refuses a date whose cut-off has passed", async () => {
    const { window } = await openDay({ date: "2020-01-01" });
    await expect(preorder(window.id)).rejects.toThrow(/udah ditutup/);
  });

  it("refuses a closed date, while the orders already on it stay", async () => {
    const { day, window } = await openDay();
    const kept = await preorder(window.id);
    await closeServiceDay(day.id);

    await expect(preorder(window.id)).rejects.toThrow(/nggak tersedia/);
    expect((await db.orm.public.Order.where({ id: kept.id }).first())?.serviceWindowId).toBe(window.id);
  });

  it("asks for the location written out when the place is Lainnya", async () => {
    const { window } = await openDay();
    await expect(preorder(window.id, "OTHER", "dkt")).rejects.toMatchObject({ field: "handoverDetail" });
  });

  it("gives the place back when the order is cancelled", async () => {
    const { window } = await openDay();
    const order = await preorder(window.id);
    const admin = await makeUser("ADMIN");

    await cancelOrder(order.id, { id: admin.id, role: "ADMIN" });
    expect((await windowOf(window.id)).booked).toBe(0);
  });
});

describe("a Lainnya order waits for staff to accept its location", () => {
  it("cannot be made or handed over before it is accepted, and can after", async () => {
    const { window } = await openDay();
    const order = await preorder(window.id, "OTHER", "Rumah kos Jl. Merpati 12, dekat kampus B");
    const cashier = await makeUser("KASIR");
    const actor = { id: cashier.id, role: "KASIR" as const };

    await expect(transitionStatus(order.id, "IN_QUEUE", actor)).rejects.toBeInstanceOf(ValidationError);

    await confirmHandoverLocation(order.id, actor);
    await expect(transitionStatus(order.id, "IN_QUEUE", actor)).resolves.toMatchObject({ status: "IN_QUEUE" });
  });

  it("is accepted once; accepting again is refused", async () => {
    const { window } = await openDay();
    const order = await preorder(window.id, "OTHER", "Rumah kos Jl. Merpati 12, dekat kampus B");
    const cashier = await makeUser("KASIR");

    await confirmHandoverLocation(order.id, { id: cashier.id, role: "KASIR" });
    await expect(confirmHandoverLocation(order.id, { id: cashier.id, role: "KASIR" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("the staff side of the schedule", () => {
  it("never lets a quota go below the places already booked", async () => {
    const { window } = await openDay({ quota: 3 });
    await preorder(window.id);
    await preorder(window.id);

    await expect(updateWindowQuota(window.id, 1)).rejects.toMatchObject({ field: "quota" });
    await updateWindowQuota(window.id, 2);
    expect((await windowOf(window.id)).quota).toBe(2);
  });

  it("keeps a range that has orders on it", async () => {
    const { window } = await openDay();
    await preorder(window.id);

    await expect(deleteServiceWindow(window.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses ranges that overlap on the same date", async () => {
    const { day } = await openDay();
    await expect(
      addServiceWindow({ dayId: day.id, startMinute: 690, endMinute: 750, quota: 5 }),
    ).rejects.toThrow(/bentrok/);
  });
});

describe("what the checkout is offered", () => {
  it("lists open dates before their cut-off, with what is left in each range", async () => {
    const { window } = await openDay({ quota: 2 });
    await preorder(window.id);
    await openDay({ date: "2020-01-01" });

    const schedule = await getBookableSchedule();
    expect(schedule.days.map((day) => day.date)).toEqual([DATE]);
    expect(schedule.days[0]!.windows[0]).toMatchObject({ label: "11.00 - 12.00", remaining: 1, isFull: false });
    expect(schedule.cutoffMinute).toBe(21 * 60);
  });
});
