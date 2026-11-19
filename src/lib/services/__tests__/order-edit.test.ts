import { Temporal } from '@js-temporal/polyfill';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma as db } from '@/lib/prisma';
import { NotFoundError, ValidationError } from '@/lib/errors';
import {
  cancelOrder,
  createOrder,
  transitionStatus,
  updateOrderDetails,
} from '@/lib/services/order.service';
import { openServiceDay } from '@/lib/services/schedule.service';
import { todayInJakarta, type HandoverLocation } from '@/lib/schedule';
import {
  closeDatabase,
  makeProduct,
  makeUser,
  resetDatabase,
} from './helpers/test-db';

/* Staff correct an order's details at the customer's request. */

const plus = (days: number) =>
  Temporal.PlainDate.from(todayInJakarta()).add({ days }).toString();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

async function openDay(
  date: string,
  options: { quota?: number; locations?: HandoverLocation[] } = {},
) {
  const day = await openServiceDay({
    date,
    locations: options.locations ?? ['CAMPUS_B', 'MARKET_DAY', 'OTHER'],
    windows: [
      { startMinute: 600, endMinute: 660, quota: options.quota ?? 2 },
      { startMinute: 660, endMinute: 720, quota: options.quota ?? 2 },
    ],
  });
  const windows = await db.orm.public.ServiceWindow.where({ dayId: day.id })
    .orderBy((w) => w.startMinute.asc())
    .all();
  return windows;
}

async function preorder(
  serviceWindowId: string,
  location: HandoverLocation = 'CAMPUS_B',
) {
  const product = await makeProduct({ stock: 10 });
  return await createOrder({
    channel: 'PREORDER',
    paymentStatus: 'UNPAID',
    customerName: 'Rani',
    customerPhone: '081234561234',
    paymentMethod: 'CASH',
    schedule: { location, detail: null, serviceWindowId },
    items: [{ productId: product.id, quantity: 1 }],
  });
}

const booked = async (id: string) =>
  (await db.orm.public.ServiceWindow.where({ id }).first())!.booked;
const reload = async (id: string) =>
  (await db.orm.public.Order.where({ id }).first())!;
const kasir = async () => {
  const user = await makeUser('KASIR');
  return { id: user.id, role: user.role };
};

describe('correcting who the order is for', () => {
  it('changes the name and the number, and moves updatedAt so the photobooth refreshes its copy', async () => {
    const [window] = await openDay(plus(5));
    const order = await preorder(window!.id);
    const before = await reload(order.id);

    await updateOrderDetails(
      order.id,
      {
        customerName: 'Rani Putri',
        customerPhone: '089876543210',
        schedule: null,
      },
      await kasir(),
    );

    const after = await reload(order.id);
    expect(after).toMatchObject({
      customerName: 'Rani Putri',
      customerPhone: '089876543210',
      serviceWindowId: window!.id,
    });
    expect(Temporal.Instant.compare(after.updatedAt, before.updatedAt)).toBe(1);
  });

  it("keeps a preorder's WhatsApp number required: the tracker and the photobooth need its last digits", async () => {
    const [window] = await openDay(plus(5));
    const order = await preorder(window!.id);

    await expect(
      updateOrderDetails(
        order.id,
        { customerName: 'Rani', customerPhone: null, schedule: null },
        await kasir(),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('refuses an order already handed over or cancelled', async () => {
    const [window] = await openDay(plus(5));
    const done = await preorder(window!.id);
    const cancelled = await preorder(window!.id);
    const admin = await makeUser('ADMIN');
    await db.orm.public.Order.where({ id: done.id }).update({
      status: 'DONE',
      paymentStatus: 'PAID',
    });
    await cancelOrder(cancelled.id, { id: admin.id, role: 'ADMIN' });

    for (const id of [done.id, cancelled.id]) {
      await expect(
        updateOrderDetails(
          id,
          {
            customerName: 'X Y',
            customerPhone: '081234561234',
            schedule: null,
          },
          await kasir(),
        ),
      ).rejects.toThrow(ValidationError);
    }
    await expect(
      updateOrderDetails(
        'no-such-order',
        { customerName: 'X Y', customerPhone: null, schedule: null },
        await kasir(),
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('moving the handover', () => {
  it('books the new time range and gives the old one its place back', async () => {
    const [early, late] = await openDay(plus(5));
    const tomorrow = await openDay(plus(6));
    const order = await preorder(early!.id);
    expect(await booked(early!.id)).toBe(1);

    await updateOrderDetails(
      order.id,
      {
        customerName: 'Rani',
        customerPhone: '081234561234',
        schedule: {
          location: 'CAMPUS_B',
          detail: null,
          serviceWindowId: tomorrow[1]!.id,
        },
      },
      await kasir(),
    );

    expect(await booked(early!.id)).toBe(0);
    expect(await booked(late!.id)).toBe(0);
    expect(await booked(tomorrow[1]!.id)).toBe(1);
    expect(await reload(order.id)).toMatchObject({
      serviceDate: plus(6),
      pickupSlot: '11.00 - 12.00',
      serviceWindowId: tomorrow[1]!.id,
    });
  });

  it('holds the new range to its quota, and changes nothing when it is full', async () => {
    const [early, late] = await openDay(plus(5), { quota: 1 });
    const order = await preorder(early!.id);
    await preorder(late!.id);

    await expect(
      updateOrderDetails(
        order.id,
        {
          customerName: 'Rani',
          customerPhone: '081234561234',
          schedule: {
            location: 'CAMPUS_B',
            detail: null,
            serviceWindowId: late!.id,
          },
        },
        await kasir(),
      ),
    ).rejects.toThrow(/udah penuh/);
    expect(await booked(early!.id)).toBe(1);
    expect((await reload(order.id)).serviceWindowId).toBe(early!.id);
  });

  it("lets staff move an order to a date past the customer's cut-off, but not into the past", async () => {
    const later = await openDay(plus(3));
    const order = await preorder(later[0]!.id);
    // Today is past every cut-off: a customer could no longer book it.
    const today = await openDay(plus(0));

    await updateOrderDetails(
      order.id,
      {
        customerName: 'Rani',
        customerPhone: '081234561234',
        schedule: {
          location: 'CAMPUS_B',
          detail: null,
          serviceWindowId: today[0]!.id,
        },
      },
      await kasir(),
    );
    expect((await reload(order.id)).serviceDate).toBe(plus(0));

    const yesterday = await openDay(plus(-1));
    await expect(
      updateOrderDetails(
        order.id,
        {
          customerName: 'Rani',
          customerPhone: '081234561234',
          schedule: {
            location: 'CAMPUS_B',
            detail: null,
            serviceWindowId: yesterday[0]!.id,
          },
        },
        await kasir(),
      ),
    ).rejects.toThrow(/udah lewat/);
  });

  it('refuses a place the date does not serve', async () => {
    const [window] = await openDay(plus(5), { locations: ['CAMPUS_B'] });
    const order = await preorder(window!.id);

    await expect(
      updateOrderDetails(
        order.id,
        {
          customerName: 'Rani',
          customerPhone: '081234561234',
          schedule: {
            location: 'MARKET_DAY',
            detail: null,
            serviceWindowId: window!.id,
          },
        },
        await kasir(),
      ),
    ).rejects.toThrow(/nggak melayani/);
  });

  it('takes a Lainnya place written by staff as checked', async () => {
    const [window] = await openDay(plus(5));
    const order = await preorder(window!.id);
    const staff = await kasir();

    await updateOrderDetails(
      order.id,
      {
        customerName: 'Rani',
        customerPhone: '081234561234',
        schedule: {
          location: 'OTHER',
          detail: 'Kos Melati, Jl. Merpati 12',
          serviceWindowId: window!.id,
        },
      },
      staff,
    );

    const after = await reload(order.id);
    expect(after).toMatchObject({
      handoverLocation: 'OTHER',
      handoverDetail: 'Kos Melati, Jl. Merpati 12',
      handledById: staff.id,
    });
    expect(after.locationReviewedAt).not.toBeNull();
    expect(await booked(window!.id)).toBe(1);
  });

  it('no longer moves an order whose customer has come for it', async () => {
    const [early, late] = await openDay(plus(5));
    const product = await makeProduct({ stock: 10, prepType: 'NEEDS_PREP' });
    const order = await createOrder({
      channel: 'PREORDER',
      paymentStatus: 'UNPAID',
      customerName: 'Rani',
      customerPhone: '081234561234',
      paymentMethod: 'CASH',
      schedule: {
        location: 'CAMPUS_B',
        detail: null,
        serviceWindowId: early!.id,
      },
      items: [{ productId: product.id, quantity: 1 }],
    });
    await db.orm.public.Order.where({ id: order.id }).update({
      paymentStatus: 'PAID',
    });
    const staff = await kasir();
    await transitionStatus(order.id, 'IN_QUEUE', staff);

    await expect(
      updateOrderDetails(
        order.id,
        {
          customerName: 'Rani',
          customerPhone: '081234561234',
          schedule: {
            location: 'CAMPUS_B',
            detail: null,
            serviceWindowId: late!.id,
          },
        },
        staff,
      ),
    ).rejects.toThrow(/udah datang/);
    // The name can still be corrected.
    await updateOrderDetails(
      order.id,
      {
        customerName: 'Rani Putri',
        customerPhone: '081234561234',
        schedule: null,
      },
      staff,
    );
    expect((await reload(order.id)).customerName).toBe('Rani Putri');
  });
});
