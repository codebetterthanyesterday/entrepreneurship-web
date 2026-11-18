import { Temporal } from "@js-temporal/polyfill";
import { EVENT_TIME_ZONE, clockLabel, describeHandover } from "@/lib/schedule";
import { formatRupiah } from "@/lib/utils";

/**
 * Chatting the team on WhatsApp: the number, the link, the hours someone
 * answers, and what each button says.
 *
 * Everything here is click-to-chat: a `wa.me` link opens the customer's own
 * WhatsApp with a message already typed, to the team's number. It works the
 * same whether that number runs WhatsApp or WhatsApp Business, needs no API
 * and costs nothing.
 *
 * Every message names the order the way the till searches for it (its number)
 * and the handover, so nobody has to ask "which order?". None carries the
 * customer's phone, a payment proof or anything else private: the chat itself
 * already shows who is writing.
 */

/** Default hours the team answers chats: 08.00–21.00 WIB. */
export const DEFAULT_CHAT_OPEN_MINUTE = 8 * 60;
export const DEFAULT_CHAT_CLOSE_MINUTE = 21 * 60;

/**
 * The number in the international form `wa.me` wants ("6281234567890"), from
 * however it was typed: "0812-3456-7890", "+62 812…", "62812…" or "812…".
 * `null` when it is not a usable number, so a caller leaves the button out
 * rather than render a dead link.
 */
export function toWhatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;

  // Written with a "+", the country code is already there, whichever it is.
  if (trimmed.startsWith("+")) return digits;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  // A mobile number typed without its leading zero.
  if (digits.startsWith("8")) return `62${digits}`;
  return null;
}

/** A link that opens a chat with `number`, `text` already typed in. */
export function whatsappChatUrl(number: string | null | undefined, text?: string): string | null {
  const international = toWhatsappNumber(number);
  if (!international) return null;
  const base = `https://wa.me/${international}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export interface ChatHours {
  openMinute: number;
  closeMinute: number;
}

/** "08.00–21.00 WIB". */
export function chatHoursLabel({ openMinute, closeMinute }: ChatHours): string {
  return `${clockLabel(openMinute)}–${clockLabel(closeMinute)} WIB`;
}

/** Whether someone on the team is answering at `now` (Jakarta time). */
export function isWithinChatHours(
  { openMinute, closeMinute }: ChatHours,
  now: Temporal.Instant = Temporal.Now.instant(),
): boolean {
  const time = now.toZonedDateTimeISO(EVENT_TIME_ZONE);
  const minute = time.hour * 60 + time.minute;
  return minute >= openMinute && minute < closeMinute;
}

/** The order facts a message can name. Only what the customer already sees. */
export interface ChatOrder {
  orderNumber: string;
  serviceDate?: string | null;
  pickupSlot?: string | null;
  handoverLocation?: string | null;
  handoverDetail?: string | null;
  totalAmount?: number;
}

/** The chat's view of an order: the fields a message may name, nothing more. */
export function chatOrderOf(order: ChatOrder): ChatOrder {
  return {
    orderNumber: order.orderNumber,
    serviceDate: order.serviceDate ?? null,
    pickupSlot: order.pickupSlot ?? null,
    handoverLocation: order.handoverLocation ?? null,
    handoverDetail: order.handoverDetail ?? null,
    ...(order.totalAmount != null ? { totalAmount: order.totalAmount } : {}),
  };
}

function orderLines(order: ChatOrder): string[] {
  const handover = describeHandover(order);
  return [`No. pesanan: ${order.orderNumber}`, ...(handover ? [`Jadwal: ${handover}`] : [])];
}

/**
 * What each button sends. The text ends where the customer carries on typing,
 * so it reads as their own message, not a form.
 */
export const chatMessage = {
  /** From the header, on any page: a question before ordering. */
  general: (brand: string) => `Halo ${brand}! Aku mau tanya dulu: `,

  /** From an order's page: anything about that order. */
  order: (brand: string, order: ChatOrder) =>
    [`Halo ${brand}! Aku mau tanya soal pesananku.`, ...orderLines(order), "", "Pertanyaanku: "].join("\n"),

  /** A "Lainnya" order waiting for its location to be checked: help find the place. */
  location: (brand: string, order: ChatOrder) =>
    [
      `Halo ${brand}! Ini patokan lokasi buat pesananku, biar gampang dicek.`,
      ...orderLines(order),
      "",
      "Patokannya: ",
    ].join("\n"),

  /** An order the customer finds cancelled. */
  cancelled: (brand: string, order: ChatOrder) =>
    [`Halo ${brand}! Pesananku tertulis dibatalkan, boleh dicek kenapa ya?`, ...orderLines(order)].join("\n"),

  /** A QRIS payment sent but not yet marked paid. */
  payment: (brand: string, order: ChatOrder) =>
    [
      `Halo ${brand}! Aku udah bayar QRIS dan kirim buktinya, tapi statusnya belum Lunas. Boleh dicek ya?`,
      `No. pesanan: ${order.orderNumber}`,
      ...(order.totalAmount != null ? [`Total: ${formatRupiah(order.totalAmount)}`] : []),
    ].join("\n"),

  /** From the tracker: the customer lost their order number. */
  forgotNumber: (brand: string) =>
    [`Halo ${brand}! Aku lupa nomor pesananku.`, "Atas nama: ", "Pesan untuk tanggal: "].join("\n"),

  /** A page that keeps failing. The digest lets us find it in the logs. */
  pageError: (brand: string, path: string, digest?: string) =>
    `Halo ${brand}! Halaman ${path} gagal dimuat terus nih${digest ? ` (kode: ${digest})` : ""}.`,
} as const;

/**
 * Which message a button sends, as plain data, so a server component can hand
 * it to the client-side button (a function could not cross that boundary).
 */
export type ChatIntent =
  | { kind: "general" }
  | { kind: "order"; order: ChatOrder }
  | { kind: "location"; order: ChatOrder }
  | { kind: "cancelled"; order: ChatOrder }
  | { kind: "payment"; order: ChatOrder }
  | { kind: "forgotNumber" }
  | { kind: "pageError"; path: string; digest?: string };

export function composeChatMessage(brand: string, intent: ChatIntent): string {
  switch (intent.kind) {
    case "general":
      return chatMessage.general(brand);
    case "order":
      return chatMessage.order(brand, intent.order);
    case "location":
      return chatMessage.location(brand, intent.order);
    case "cancelled":
      return chatMessage.cancelled(brand, intent.order);
    case "payment":
      return chatMessage.payment(brand, intent.order);
    case "forgotNumber":
      return chatMessage.forgotNumber(brand);
    case "pageError":
      return chatMessage.pageError(brand, intent.path, intent.digest);
  }
}
