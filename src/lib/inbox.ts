import { Temporal } from "@js-temporal/polyfill";
import { bundlesAvailable } from "@/lib/bundle";
import { needsLocationNotice } from "@/lib/customer-chat";
import { EVENT_TIME_ZONE, formatServiceDate, isDelivered, needsLocationReview } from "@/lib/schedule";
import type { OrderStatus, PaymentMethod, PaymentStatus, UserRole } from "@/types/order";

/**
 * The staff inbox: what needs a person, now, for each role.
 *
 * Nothing here is stored. Every item is read off the data as it stands, so an
 * item is there exactly while its reason is: marking a QRIS order paid is what
 * takes "Bukti QRIS masuk" away. There is nothing to dismiss, nothing to go
 * stale, and no second record of an order to keep in step with the first.
 *
 * Pure: the snapshot and the clock come in, the items go out.
 */

/** A preorder still "Belum diambil" this long after its time range ended is late. */
export const LATE_PICKUP_MINUTES = 15;
/** An order queued this long without the kitchen starting it is waiting too long. */
export const KITCHEN_WAIT_MINUTES = 10;
/** A time range with this many places left or fewer is nearly full. */
export const NEARLY_FULL_PLACES = 2;

export type InboxTone = "urgent" | "action" | "watch";

export type InboxKind =
  | "qris-proof"
  | "location-check"
  | "location-notice"
  | "ready"
  | "late-pickup"
  | "kitchen-wait"
  | "stock-out"
  | "stock-low"
  | "window-full"
  | "bundle-unavailable";

export interface InboxItem {
  /** Stable while the reason lasts, e.g. "qris-proof:PO-7KX4QM". */
  key: string;
  kind: InboxKind;
  tone: InboxTone;
  title: string;
  detail: string;
  /** Since when, ISO: what "3 menit lalu" counts from. */
  since: string;
  href: string;
  actionLabel: string;
}

export interface InboxOrder {
  id: string;
  orderNumber: string;
  channel: "PREORDER" | "ONSITE";
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  customerName: string;
  customerPhone: string | null;
  totalAmount: number;
  hasPaymentProof: boolean;
  serviceDate: string | null;
  pickupSlot: string | null;
  /** The booked time range's end, in minutes after 00:00 WIB. */
  windowEndMinute: number | null;
  handoverLocation: string | null;
  handoverDetail: string | null;
  locationReviewedAt: string | null;
  locationNotifiedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  queuedAt: string | null;
  readyAt: string | null;
}

export interface InboxSnapshot {
  orders: readonly InboxOrder[];
  products: readonly { id: string; name: string; stock: number; isActive: boolean }[];
  bundles: readonly {
    id: string;
    name: string;
    isActive: boolean;
    items: readonly { productId: string; quantity: number }[];
  }[];
  /** Open dates from today on. */
  windows: readonly { date: string; label: string; quota: number; booked: number }[];
  lowStockThreshold: number;
}

/** Which roles see which kind. Admin covers every role, so sees everything. */
const AUDIENCE: Readonly<Record<InboxKind, readonly UserRole[]>> = {
  "qris-proof": ["KASIR", "ADMIN"],
  "location-check": ["KASIR", "ADMIN"],
  "location-notice": ["KASIR", "ADMIN"],
  ready: ["KASIR", "ADMIN"],
  "late-pickup": ["KASIR", "ADMIN"],
  "kitchen-wait": ["DAPUR", "ADMIN"],
  "stock-out": ["ADMIN"],
  "stock-low": ["ADMIN"],
  "window-full": ["ADMIN"],
  "bundle-unavailable": ["ADMIN"],
};

const TONE_ORDER: Readonly<Record<InboxTone, number>> = { urgent: 0, action: 1, watch: 2 };

const preorderHref = (orderNumber: string) => `/kasir/preorder?pesanan=${encodeURIComponent(orderNumber)}`;

/** "PO-7KX4QM · Rani". */
const who = (order: InboxOrder) => `${order.orderNumber} · ${order.customerName}`;

/** Minutes after 00:00 in Jakarta, and the Jakarta date, of `now`. */
function wallClock(now: Temporal.Instant): { date: string; minute: number } {
  const here = now.toZonedDateTimeISO(EVENT_TIME_ZONE);
  return { date: here.toPlainDate().toString(), minute: here.hour * 60 + here.minute };
}

/** The items `role` should see, the most pressing first, then the longest waiting. */
export function buildInbox(snapshot: InboxSnapshot, role: UserRole, now: Temporal.Instant): InboxItem[] {
  const clock = wallClock(now);
  const nowIso = now.toString();
  const items: InboxItem[] = [];

  for (const order of snapshot.orders) {
    const active = order.status !== "DONE" && order.status !== "CANCELLED";

    if (
      active &&
      order.channel === "PREORDER" &&
      order.paymentMethod === "QRIS" &&
      order.paymentStatus === "UNPAID" &&
      order.hasPaymentProof
    ) {
      items.push({
        key: `qris-proof:${order.orderNumber}`,
        kind: "qris-proof",
        tone: "urgent",
        title: "Bukti QRIS masuk",
        detail: `${who(order)} · cocokkan dengan notifikasi QRIS, lalu tandai lunas`,
        since: order.updatedAt,
        href: preorderHref(order.orderNumber),
        actionLabel: "Cek bukti",
      });
    }

    if (needsLocationReview(order)) {
      items.push({
        key: `location-check:${order.orderNumber}`,
        kind: "location-check",
        tone: "urgent",
        title: "Lokasi “Lainnya” perlu dicek",
        detail: `${who(order)}${order.handoverDetail ? ` · ${order.handoverDetail}` : ""}`,
        since: order.createdAt,
        href: preorderHref(order.orderNumber),
        actionLabel: "Cek lokasi",
      });
    }

    if (
      needsLocationNotice(
        {
          handoverLocation: order.handoverLocation,
          status: order.status,
          notes: order.notes,
          awaitingLocationCheck: needsLocationReview(order),
          locationNotifiedAt: order.locationNotifiedAt,
          serviceDate: order.serviceDate,
        },
        clock.date,
      )
    ) {
      items.push({
        key: `location-notice:${order.orderNumber}`,
        kind: "location-notice",
        tone: "action",
        title: "Pelanggan belum dikabari",
        detail: `${who(order)} · kabari hasil cek lokasinya`,
        since: order.locationReviewedAt ?? order.updatedAt,
        href: preorderHref(order.orderNumber),
        actionLabel: "Chat pelanggan",
      });
    }

    if (order.channel === "PREORDER" && order.status === "READY") {
      items.push({
        key: `ready:${order.orderNumber}`,
        kind: "ready",
        tone: "action",
        title: "Siap diserahkan",
        detail: who(order),
        since: order.readyAt ?? order.updatedAt,
        href: preorderHref(order.orderNumber),
        actionLabel: "Buka pesanan",
      });
    }

    if (
      order.channel === "PREORDER" &&
      order.status === "CONFIRMED" &&
      order.serviceDate === clock.date &&
      order.windowEndMinute !== null &&
      clock.minute >= order.windowEndMinute + LATE_PICKUP_MINUTES
    ) {
      const delivered = isDelivered(order);
      items.push({
        key: `late-pickup:${order.orderNumber}`,
        kind: "late-pickup",
        tone: "action",
        title: delivered ? "Belum diantar" : "Pelanggan belum datang",
        detail: `${who(order)} · jamnya ${order.pickupSlot ?? "sudah lewat"}`,
        since: endOfWindow(order.serviceDate, order.windowEndMinute),
        href: preorderHref(order.orderNumber),
        actionLabel: delivered ? "Buka pesanan" : "Chat pelanggan",
      });
    }

    if (
      order.status === "IN_QUEUE" &&
      order.queuedAt &&
      Temporal.Instant.from(order.queuedAt).add({ minutes: KITCHEN_WAIT_MINUTES }).epochMilliseconds <=
        now.epochMilliseconds
    ) {
      items.push({
        key: `kitchen-wait:${order.orderNumber}`,
        kind: "kitchen-wait",
        tone: "action",
        title: "Antre terlalu lama",
        detail: `${who(order)} · belum mulai diracik`,
        since: order.queuedAt,
        href: "/dapur",
        actionLabel: "Buka dapur",
      });
    }
  }

  const stockOf = new Map(snapshot.products.map((product) => [product.id, product]));

  for (const product of snapshot.products) {
    if (!product.isActive) continue;
    if (product.stock <= 0) {
      items.push({
        key: `stock-out:${product.id}`,
        kind: "stock-out",
        tone: "watch",
        title: "Stok habis",
        detail: `${product.name} · nggak bisa dipesan`,
        since: nowIso,
        href: "/admin/menu",
        actionLabel: "Atur stok",
      });
    } else if (product.stock <= snapshot.lowStockThreshold) {
      items.push({
        key: `stock-low:${product.id}`,
        kind: "stock-low",
        tone: "watch",
        title: "Stok menipis",
        detail: `${product.name} · sisa ${product.stock}`,
        since: nowIso,
        href: "/admin/menu",
        actionLabel: "Atur stok",
      });
    }
  }

  for (const window of snapshot.windows) {
    const left = window.quota - window.booked;
    if (left > NEARLY_FULL_PLACES) continue;
    items.push({
      key: `window-full:${window.date}:${window.label}`,
      kind: "window-full",
      tone: "watch",
      title: left <= 0 ? "Jam layanan penuh" : "Jam layanan hampir penuh",
      detail: `${formatServiceDate(window.date)} · ${window.label} · ${left <= 0 ? "kuota habis" : `sisa ${left}`}`,
      since: nowIso,
      href: "/admin/pengaturan",
      actionLabel: "Atur jadwal",
    });
  }

  for (const bundle of snapshot.bundles) {
    if (!bundle.isActive) continue;
    const hidden = bundle.items.some((item) => !stockOf.get(item.productId)?.isActive);
    const available = bundlesAvailable(bundle.items, (id) => {
      const product = stockOf.get(id);
      return product?.isActive ? product.stock : 0;
    });
    if (!hidden && available > 0) continue;
    items.push({
      key: `bundle-unavailable:${bundle.id}`,
      kind: "bundle-unavailable",
      tone: "watch",
      title: "Paket nggak bisa dijual",
      detail: `${bundle.name} · ${hidden ? "ada isi yang disembunyiin" : "isinya habis"}`,
      since: nowIso,
      href: "/admin/menu",
      actionLabel: "Buka paket",
    });
  }

  return items
    .filter((item) => AUDIENCE[item.kind].includes(role))
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || a.since.localeCompare(b.since));
}

/** The moment a time range on `date` ends, as an ISO instant. */
function endOfWindow(date: string, endMinute: number): string {
  return Temporal.PlainDate.from(date)
    .toZonedDateTime({ timeZone: EVENT_TIME_ZONE, plainTime: new Temporal.PlainTime(0, 0) })
    .add({ minutes: endMinute })
    .toInstant()
    .toString();
}
