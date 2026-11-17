import { Temporal } from "@js-temporal/polyfill";

/**
 * The preorder schedule's rules: where an order can be handed over, which
 * dates can still be booked, and how a time range is written.
 *
 * Pure, so the server (which enforces them), the checkout (which shows them)
 * and the staff screens (which read them) agree, and the rules are tested
 * without a database.
 */

export const EVENT_TIME_ZONE = "Asia/Jakarta";

export const HANDOVER_LOCATIONS = ["CAMPUS_B", "CAMPUS_C", "MARKET_DAY", "OTHER"] as const;
export type HandoverLocation = (typeof HANDOVER_LOCATIONS)[number];

export const HANDOVER_LABEL: Readonly<Record<HandoverLocation, string>> = {
  CAMPUS_B: "Kampus B (Halimun)",
  CAMPUS_C: "Kampus C (Minangkabau)",
  MARKET_DAY: "Market Day",
  OTHER: "Lainnya",
};

/** One line under each choice at checkout. */
export const HANDOVER_HINT: Readonly<Record<HandoverLocation, string>> = {
  CAMPUS_B: "Diantar ke Kampus B, titik temu bisa kamu tulis",
  CAMPUS_C: "Diantar ke Kampus C, titik temu bisa kamu tulis",
  MARKET_DAY: "Ambil di booth kami pas Market Day",
  OTHER: "Tulis lokasinya lengkap, kami cek dulu jangkauannya",
};

export function isHandoverLocation(value: unknown): value is HandoverLocation {
  return typeof value === "string" && (HANDOVER_LOCATIONS as readonly string[]).includes(value);
}

/** The bounds a customer's own handover note has to stay within. */
export const HANDOVER_DETAIL_MAX = 160;
export const OTHER_DETAIL_MIN = 8;

/** Default cut-off: orders for day D close at 21.00 on D-1 (WIB). */
export const DEFAULT_CUTOFF_MINUTE = 21 * 60;

const pad = (value: number) => String(value).padStart(2, "0");

/** "11.00", from minutes since midnight. */
export function clockLabel(minute: number): string {
  return `${pad(Math.floor(minute / 60))}.${pad(minute % 60)}`;
}

/** "11.00 - 12.00": how a time range is written everywhere, and stored on the order. */
export function windowLabel(startMinute: number, endMinute: number): string {
  return `${clockLabel(startMinute)} - ${clockLabel(endMinute)}`;
}

/** Whether a range is one the schedule can hold: inside one day, at least 15 minutes. */
export function isValidWindow(startMinute: number, endMinute: number): boolean {
  return (
    Number.isInteger(startMinute) &&
    Number.isInteger(endMinute) &&
    startMinute >= 0 &&
    endMinute <= 24 * 60 &&
    endMinute - startMinute >= 15
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar date as stored ("2026-11-24"), or `null` if the text is not one. */
export function parseServiceDate(value: string): Temporal.PlainDate | null {
  if (!ISO_DATE.test(value)) return null;
  try {
    return Temporal.PlainDate.from(value, { overflow: "reject" });
  } catch {
    return null;
  }
}

/** Today's date in Jakarta, the booth's day, whatever the server's clock zone. */
export function todayInJakarta(now: Temporal.Instant = Temporal.Now.instant()): string {
  return now.toZonedDateTimeISO(EVENT_TIME_ZONE).toPlainDate().toString();
}

/** The moment orders for `date` close: `cutoffMinute` on the day before, in Jakarta. */
export function cutoffInstant(date: string, cutoffMinute: number): Temporal.Instant {
  const day = parseServiceDate(date);
  if (!day) throw new RangeError(`Not a service date: ${date}`);
  return day
    .subtract({ days: 1 })
    .toZonedDateTime({ timeZone: EVENT_TIME_ZONE, plainTime: Temporal.PlainTime.from("00:00") })
    .add({ minutes: cutoffMinute })
    .toInstant();
}

/** Whether `date` can still be booked at `now`. */
export function isBookable(
  date: string,
  cutoffMinute: number,
  now: Temporal.Instant = Temporal.Now.instant(),
): boolean {
  if (!parseServiceDate(date)) return false;
  return Temporal.Instant.compare(now, cutoffInstant(date, cutoffMinute)) < 0;
}

const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/** "Kamis, 19 Nov 2026". */
export function formatServiceDate(date: string): string {
  const day = parseServiceDate(date);
  if (!day) return date;
  return `${DAY_NAMES[day.dayOfWeek - 1]}, ${day.day} ${MONTH_NAMES[day.month - 1]} ${day.year}`;
}

/**
 * The whole handover in one line, for the ticket, the till and the export:
 * "Kamis, 19 Nov 2026 · 11.00 - 12.00 · Kampus C (Minangkabau) · Depan gazebo".
 * Orders from before the schedule have only the time range; that is all it says.
 */
export function describeHandover(order: {
  serviceDate?: string | null;
  pickupSlot?: string | null;
  handoverLocation?: string | null;
  handoverDetail?: string | null;
}): string {
  const parts = [
    order.serviceDate ? formatServiceDate(order.serviceDate) : null,
    order.pickupSlot ?? null,
    isHandoverLocation(order.handoverLocation) ? HANDOVER_LABEL[order.handoverLocation] : null,
    order.handoverDetail?.trim() || null,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** Whether an order is still waiting for staff to accept its "Lainnya" location. */
export function needsLocationReview(order: {
  handoverLocation?: string | null;
  locationReviewedAt?: unknown;
  status?: string;
}): boolean {
  return order.handoverLocation === "OTHER" && !order.locationReviewedAt && order.status !== "CANCELLED";
}

/**
 * Whether an order becomes a photobooth session. The booth only stands at
 * Market Day, so only a preorder handed over there does; one from before the
 * schedule (no place recorded) was a Market Day order and still does.
 */
export function goesToPhotobooth(order: { channel: string; handoverLocation?: string | null }): boolean {
  return order.channel === "PREORDER" && (order.handoverLocation == null || order.handoverLocation === "MARKET_DAY");
}
