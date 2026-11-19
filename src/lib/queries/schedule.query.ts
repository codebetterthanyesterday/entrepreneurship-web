import { Temporal } from "@js-temporal/polyfill";
import { prisma as db } from "@/lib/prisma";
import {
  DEFAULT_CUTOFF_MINUTE,
  isBookable,
  isHandoverLocation,
  todayInJakarta,
  windowLabel,
  type HandoverLocation,
} from "@/lib/schedule";

/** A time range as the checkout shows it. */
export interface BookableWindow {
  id: string;
  label: string;
  remaining: number;
  isFull: boolean;
}

/** A date a customer can still choose, with the places it serves. */
export interface BookableDay {
  date: string;
  locations: HandoverLocation[];
  windows: BookableWindow[];
}

export interface BookableSchedule {
  days: BookableDay[];
  /** Minutes after midnight WIB on the day before, when a date closes. */
  cutoffMinute: number;
}

/** How far ahead the checkout looks. */
const HORIZON_DAYS = 90;

/**
 * The dates a customer can book right now: open, serving at least one place,
 * holding at least one time range, and not past their cut-off (21.00 WIB the
 * day before, by default). Full ranges are kept and marked, so the customer
 * sees they exist; a date whose every range is full is kept too.
 *
 * With `staff`, every open date from today on, cut-off or not: what a cashier
 * may move an order to.
 */
export async function getBookableSchedule(
  now: Temporal.Instant = Temporal.Now.instant(),
  { staff = false }: { staff?: boolean } = {},
): Promise<BookableSchedule> {
  const settings = await db.orm.public.StoreSetting.where({ id: 1 }).first();
  const cutoffMinute = settings?.orderCutoffMinute ?? DEFAULT_CUTOFF_MINUTE;

  const today = todayInJakarta(now);
  const last = Temporal.PlainDate.from(today).add({ days: HORIZON_DAYS }).toString();

  const rows = await db.orm.public.ServiceDay.where({ isOpen: true })
    .where((day) => day.date.gte(today))
    .where((day) => day.date.lte(last))
    .include("windows")
    .orderBy((day) => day.date.asc())
    .all();

  const days = rows
    // Staff moving an order are not held to the customer's cut-off, only to
    // today and later (`updateOrderDetails`).
    .filter((day) => staff || isBookable(day.date, cutoffMinute, now))
    .map((day) => ({
      date: day.date,
      locations: day.locations.filter(isHandoverLocation),
      windows: [...day.windows]
        .sort((a, b) => a.startMinute - b.startMinute)
        .map((window) => ({
          id: window.id,
          label: windowLabel(window.startMinute, window.endMinute),
          remaining: Math.max(0, window.quota - window.booked),
          isFull: window.booked >= window.quota,
        })),
    }))
    .filter((day) => day.locations.length > 0 && day.windows.length > 0);

  return { days, cutoffMinute };
}

/** A date on the staff calendar, open or closed, with its ranges and their bookings. */
export interface AdminServiceDay {
  id: string;
  date: string;
  isOpen: boolean;
  locations: HandoverLocation[];
  windows: {
    id: string;
    startMinute: number;
    endMinute: number;
    label: string;
    quota: number;
    booked: number;
  }[];
}

/** Every configured date from `from` on, for the staff calendar. */
export async function getScheduleForAdmin(from: string): Promise<AdminServiceDay[]> {
  const rows = await db.orm.public.ServiceDay.where((day) => day.date.gte(from))
    .include("windows")
    .orderBy((day) => day.date.asc())
    .all();

  return rows.map((day) => ({
    id: day.id,
    date: day.date,
    isOpen: day.isOpen,
    locations: day.locations.filter(isHandoverLocation),
    windows: [...day.windows]
      .sort((a, b) => a.startMinute - b.startMinute)
      .map((window) => ({
        id: window.id,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
        label: windowLabel(window.startMinute, window.endMinute),
        quota: window.quota,
        booked: window.booked,
      })),
  }));
}
