import { Temporal } from "@js-temporal/polyfill";
import { getPickupSlots } from "@/lib/services/setting.service";

/** Market Day runs on Jakarta time, wherever the server happens to be. */
const EVENT_TIME_ZONE = "Asia/Jakarta";

export interface PublicPickupSlot {
  id: string;
  label: string;
  quota: number;
  booked: number;
  isFull: boolean;
  /** The slot's window has already closed today. */
  isPast: boolean;
  /** Convenience for the UI: full, past, or switched off. */
  isSelectable: boolean;
}

/**
 * Minutes past midnight for the end of a label like "09.00 - 10.00".
 *
 * Labels are typed by hand in the admin screen, so anything that does not parse
 * returns `null` and the slot is simply never treated as past — a slot we
 * cannot read the clock from should stay bookable rather than silently vanish.
 */
export function parseSlotEndMinutes(label: string): number | null {
  const parts = label.match(/(\d{1,2})[.:](\d{2})/g);
  if (!parts || parts.length === 0) return null;

  const end = parts[parts.length - 1]!.match(/(\d{1,2})[.:](\d{2})/);
  if (!end) return null;

  const hours = Number(end[1]);
  const minutes = Number(end[2]);

  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/**
 * Pickup slots as the checkout form sees them, with the reason a slot cannot be
 * chosen already worked out.
 *
 * `booked` comes off the slot row rather than from counting orders, which is
 * the same counter `createOrder` increments under its guarded update — so what
 * the customer sees and what the database enforces cannot drift apart.
 */
export async function getSelectablePickupSlots(
  now: Temporal.Instant = Temporal.Now.instant(),
): Promise<PublicPickupSlot[]> {
  const slots = await getPickupSlots();

  const localNow = now.toZonedDateTimeISO(EVENT_TIME_ZONE);
  const minutesNow = localNow.hour * 60 + localNow.minute;

  return slots
    .filter((slot) => slot.isActive)
    .map((slot) => {
      const endMinutes = parseSlotEndMinutes(slot.label);
      const isFull = slot.booked >= slot.quota;
      const isPast = endMinutes !== null && endMinutes <= minutesNow;

      return {
        id: slot.id,
        label: slot.label,
        quota: slot.quota,
        booked: slot.booked,
        isFull,
        isPast,
        isSelectable: !isFull && !isPast,
      };
    });
}
