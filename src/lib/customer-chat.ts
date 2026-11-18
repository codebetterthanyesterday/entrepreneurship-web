import { HANDOVER_LABEL, HANDOVER_LOCATIONS, describeHandover, todayInJakarta } from "@/lib/schedule";
import { formatRupiah } from "@/lib/utils";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/types/order";

/**
 * Staff chatting a customer on WhatsApp, from the till or the admin's order
 * sheet: which messages fit the order as it stands, and what each one says.
 *
 * The visitor's side is `@/lib/whatsapp`; this is the same click-to-chat link
 * pointed the other way, at the number the customer gave at checkout. Every
 * message is signed with the brand and names the order, so the customer knows
 * who is writing and about what before reading on.
 */

/** The reason the till writes on a "Lainnya" order it cancels for being out of reach. */
export const LOCATION_REJECTED_REASON = "Lokasi di luar jangkauan";

/** The order facts the staff's messages use. */
export interface StaffChatOrder {
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** A QRIS proof was sent and waits for the cashier: no reminder to pay then. */
  hasPaymentProof: boolean;
  totalAmount: number;
  serviceDate: string | null;
  pickupSlot: string | null;
  handoverLocation: string | null;
  handoverDetail: string | null;
  awaitingLocationCheck: boolean;
  /** When the customer was told the outcome of their location's check, ISO. */
  locationNotifiedAt: string | null;
  notes: string | null;
}

export type CustomerTemplate =
  | "askLandmark"
  | "locationAccepted"
  | "locationRejected"
  | "paymentReminder"
  | "ready"
  | "onTheWay"
  | "delay"
  | "general";

/** What each template's button says on the staff's screen. */
export const CUSTOMER_TEMPLATE_LABEL: Readonly<Record<CustomerTemplate, string>> = {
  askLandmark: "Minta patokan lokasi",
  locationAccepted: "Kabari: lokasi diterima",
  locationRejected: "Kabari: lokasi ditolak, tawarkan lokasi lain",
  paymentReminder: "Ingatkan bayar QRIS",
  ready: "Pesanan siap diambil",
  onTheWay: "Pesanan lagi diantar",
  delay: "Ada kendala atau jadwal mundur",
  general: "Chat tanpa template",
};

/**
 * The templates that tell a "Lainnya" customer how the check of their location
 * went. Opening one marks the customer as told.
 */
export const NOTIFYING_TEMPLATES: ReadonlySet<CustomerTemplate> = new Set([
  "locationAccepted",
  "locationRejected",
]);

/** A "Lainnya" order the till cancelled because the place is out of reach. */
export function isLocationRejected(order: Pick<StaffChatOrder, "handoverLocation" | "status" | "notes">): boolean {
  return (
    order.handoverLocation === "OTHER" &&
    order.status === "CANCELLED" &&
    (order.notes ?? "").includes(LOCATION_REJECTED_REASON)
  );
}

/**
 * Whether a "Lainnya" customer still has to be told how the check of their
 * location went: it was accepted or rejected, nobody has said so yet, and the
 * handover is not behind us (telling them afterwards helps nobody).
 */
export function needsLocationNotice(
  order: Pick<
    StaffChatOrder,
    "handoverLocation" | "status" | "notes" | "awaitingLocationCheck" | "locationNotifiedAt" | "serviceDate"
  >,
  today: string = todayInJakarta(),
): boolean {
  if (order.handoverLocation !== "OTHER" || order.awaitingLocationCheck || order.locationNotifiedAt) return false;
  if (order.serviceDate && order.serviceDate < today) return false;
  if (order.status === "DONE") return false;
  return order.status !== "CANCELLED" || isLocationRejected(order);
}

const isDelivery = (location: string | null) =>
  location === "CAMPUS_B" || location === "CAMPUS_C" || location === "OTHER";

/** The templates that make sense for the order as it stands, the likeliest first. */
export function customerTemplates(order: StaffChatOrder): CustomerTemplate[] {
  if (order.awaitingLocationCheck) return ["askLandmark", "general"];
  if (order.status === "CANCELLED") {
    return isLocationRejected(order) ? ["locationRejected", "general"] : ["general"];
  }
  if (order.status === "DONE") return ["general"];

  const templates: CustomerTemplate[] = [];
  if (order.handoverLocation === "OTHER") templates.push("locationAccepted");
  if (order.paymentMethod === "QRIS" && order.paymentStatus === "UNPAID" && !order.hasPaymentProof) {
    templates.push("paymentReminder");
  }
  templates.push(isDelivery(order.handoverLocation) ? "onTheWay" : "ready", "delay", "general");
  return templates;
}

export interface CustomerMessageContext {
  brand: string;
  /** The site's address ("https://bunnye.vercel.app"), for links in the message. */
  origin: string;
}

/** "Kampus B (Halimun), Kampus C (Minangkabau) atau Market Day". */
function otherPlaces(): string {
  const labels = HANDOVER_LOCATIONS.filter((location) => location !== "OTHER").map(
    (location) => HANDOVER_LABEL[location],
  );
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} atau ${labels.at(-1)}` : (labels[0] ?? "");
}

const orderUrl = (origin: string, orderNumber: string) => `${origin}/pesanan/${encodeURIComponent(orderNumber)}`;

const owesQris = (order: StaffChatOrder) =>
  order.paymentMethod === "QRIS" && order.paymentStatus === "UNPAID" && !order.hasPaymentProof;

const owesCash = (order: StaffChatOrder) => order.paymentMethod === "CASH" && order.paymentStatus === "UNPAID";

/**
 * The message a template opens WhatsApp with. Where the staff member is meant
 * to carry on typing, the text ends there.
 */
export function composeCustomerMessage(
  template: CustomerTemplate,
  order: StaffChatOrder,
  { brand, origin }: CustomerMessageContext,
): string {
  const hello = `Halo ${order.customerName.trim()}, ini ${brand}.`;
  const no = order.orderNumber;
  const handover = describeHandover(order);
  const place = order.handoverDetail?.trim();

  switch (template) {
    case "askLandmark":
      return [
        hello,
        `Kami lagi cek lokasi antar pesanan ${no}${place ? `: ${place}` : ""}.`,
        "Boleh kirim patokan atau share location-nya? Habis itu langsung kami kabari bisa atau nggaknya.",
      ].join("\n");

    case "locationAccepted":
      return [
        hello,
        `Lokasi antar pesanan ${no} bisa kami jangkau, jadi pesananmu lanjut ya.`,
        ...(handover ? [`Jadwal: ${handover}`] : []),
        ...(owesQris(order) ? [`Tinggal bayar QRIS-nya di sini: ${orderUrl(origin, no)}`] : []),
        "Sampai ketemu!",
      ].join("\n");

    case "locationRejected":
      return [
        hello,
        `Maaf, lokasi ${place ? `"${place}" ` : ""}di luar jangkauan antar kami, jadi pesanan ${no} kami batalkan.`,
        ...(order.paymentStatus === "PAID"
          ? ["Pembayaranmu kami kembalikan. Balas chat ini dengan nomor e-wallet atau rekening tujuannya ya."]
          : []),
        `Kalau mau, kamu bisa pesan lagi dan pilih ${otherPlaces()}: ${origin}`,
      ].join("\n");

    case "paymentReminder":
      return [
        hello,
        `Pesanan ${no} (total ${formatRupiah(order.totalAmount)}) belum kebayar nih. Bayar QRIS-nya bisa lewat halaman pesananmu, terus upload buktinya di situ ya:`,
        orderUrl(origin, no),
      ].join("\n");

    case "ready":
      return [
        hello,
        `Pesanan ${no} udah siap! Ambil di booth kami ya, tunjukin nomor pesanannya ke kasir.`,
        ...(owesCash(order) ? [`Bayarnya pas ambil: ${formatRupiah(order.totalAmount)}.`] : []),
      ].join("\n");

    case "onTheWay": {
      const where = [
        order.handoverLocation && order.handoverLocation !== "OTHER"
          ? HANDOVER_LABEL[order.handoverLocation as keyof typeof HANDOVER_LABEL]
          : null,
        place,
      ]
        .filter(Boolean)
        .join(" · ");
      return [
        hello,
        `Pesanan ${no} lagi kami antar${where ? ` ke ${where}` : ""}. Ditunggu ya!`,
        ...(owesCash(order) ? [`Siapin ${formatRupiah(order.totalAmount)} ya, bayarnya pas terima.`] : []),
      ].join("\n");
    }

    case "delay":
      return `${hello} Maaf, pesanan ${no}${handover ? ` (${handover})` : ""} ada kendala: `;

    case "general":
      return `${hello} Soal pesanan ${no}: `;
  }
}
