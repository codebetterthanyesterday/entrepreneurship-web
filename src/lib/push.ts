import webpush from "web-push";
import { after } from "next/server";
import { prisma as db } from "@/lib/prisma";
import { AUDIENCE, type InboxKind } from "@/lib/inbox";
import type { UserRole } from "@/types/order";

/**
 * Notifications to staff phones even with the app closed (inbox phase 3),
 * sent the moment something happens: a QRIS receipt arrives, a "Lainnya"
 * order is placed, an order is ready to hand over. Who gets one follows the
 * inbox: the roles that would see the item there.
 *
 * Things that become due with time ("belum datang", "antre lama") are not
 * pushed: that would take a scheduler running every minute, which the free
 * tier does not have. They still show, chime and count in the open app.
 *
 * Without VAPID keys in the environment (development, tests) nothing is sent.
 */

export type PushEvent =
  | { kind: "qris-proof"; orderNumber: string; customerName: string }
  | { kind: "location-check"; orderNumber: string; customerName: string; detail: string | null }
  | { kind: "ready"; orderNumber: string; customerName: string };

export interface PushMessage {
  title: string;
  body: string;
  /** Where a tap opens. */
  href: string;
  /** A second notification for the same item replaces the first. */
  tag: string;
}

const preorderHref = (orderNumber: string) => `/kasir/preorder?pesanan=${encodeURIComponent(orderNumber)}`;

/** What the phone shows for an event: the inbox's words, the inbox's link. */
export function pushMessage(event: PushEvent): PushMessage {
  const who = `${event.orderNumber} · ${event.customerName}`;
  switch (event.kind) {
    case "qris-proof":
      return {
        title: "Bukti QRIS masuk",
        body: `${who} · cocokkan dengan notifikasi QRIS, lalu tandai lunas`,
        href: preorderHref(event.orderNumber),
        tag: `qris-proof:${event.orderNumber}`,
      };
    case "location-check":
      return {
        title: "Lokasi “Lainnya” perlu dicek",
        body: event.detail ? `${who} · ${event.detail}` : who,
        href: preorderHref(event.orderNumber),
        tag: `location-check:${event.orderNumber}`,
      };
    case "ready":
      return {
        title: "Siap diserahkan",
        body: who,
        href: preorderHref(event.orderNumber),
        tag: `ready:${event.orderNumber}`,
      };
  }
}

/** The roles an event goes to: those whose inbox would show it. */
export function pushAudience(kind: PushEvent["kind"]): readonly UserRole[] {
  return AUDIENCE[kind satisfies InboxKind];
}

/** The public half of the VAPID pair, for a phone subscribing; null when push is off. */
export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

function configured(): boolean {
  const publicKey = vapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || "https://bunnye.vercel.app", publicKey, privateKey);
  return true;
}

/**
 * Sends `event` to every subscribed phone of an active staff member in its
 * audience. Never throws: a notification that does not arrive must not undo
 * or fail the sale that caused it. Subscriptions the push service has
 * forgotten (404, 410) are removed.
 */
export async function notifyStaff(event: PushEvent): Promise<{ sent: number; removed: number }> {
  try {
    if (!configured()) return { sent: 0, removed: 0 };
    const roles = [...pushAudience(event.kind)];
    const subscriptions = await db.orm.public.PushSubscription.include("user").all();
    const targets = subscriptions.filter((sub) => sub.user.isActive && roles.includes(sub.user.role));
    const payload = JSON.stringify(pushMessage(event));

    let sent = 0;
    const gone: string[] = [];
    await Promise.all(
      targets.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 60 * 60, urgency: "high" },
          );
          sent += 1;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(sub.id);
          else console.error("[push] send failed", status ?? error);
        }
      }),
    );
    if (gone.length > 0) await db.orm.public.PushSubscription.where((sub) => sub.id.in(gone)).deleteAll();
    return { sent, removed: gone.length };
  } catch (error) {
    console.error("[push] notifyStaff", error);
    return { sent: 0, removed: 0 };
  }
}

/**
 * Runs `task` once the response has gone, so a customer or a cashier never
 * waits on a notification. Outside a request (a script, a unit test) there is
 * no "after", so it simply runs, its failures logged rather than thrown.
 */
export function afterResponse(task: () => Promise<unknown>): void {
  const safe = () => task().catch((error) => console.error("[push] after response", error));
  try {
    after(safe);
  } catch {
    void safe();
  }
}
