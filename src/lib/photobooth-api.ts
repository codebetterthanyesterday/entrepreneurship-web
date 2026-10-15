import { createHash, timingSafeEqual } from "node:crypto";
import { Temporal } from "@js-temporal/polyfill";
import type { OrderWithItems } from "@/lib/services/order.service";
import { lastFourDigits } from "@/lib/remembered-order";
import type { OrderStatus, PaymentStatus } from "@/types/order";

/**
 * The internal API the photobooth service calls, version 1.
 *
 * The contract lives in the photobooth repo, docs/adr/003-main-app-contract.md.
 * Change that document first; this file follows it.
 */

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export type ErrorCode = "unauthorized" | "invalid_request" | "not_found" | "internal";

/** What the photobooth is told about one preorder, and nothing more. */
export interface PreorderV1 {
  orderNumber: string;
  customerName: string;
  /** Last four digits of the WhatsApp number; the full number never leaves. */
  phoneLast4: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  pickupSlot: string | null;
  items: { name: string; quantity: number }[];
  createdAt: string;
  updatedAt: string;
}

// Machine-to-machine: no caching anywhere between the two services.
const HEADERS = { "Cache-Control": "no-store" };

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ ok: true, data }, { status, headers: HEADERS });
}

export function fail(status: number, error: ErrorCode, field?: string): Response {
  const body = field ? { ok: false, error, field } : { ok: false, error };
  return Response.json(body, { status, headers: HEADERS });
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/** Shorter values are ignored, so a half-pasted secret cannot be guessed. */
const MIN_SECRET_LENGTH = 32;

/**
 * The secrets the photobooth may present, from PHOTOBOOTH_API_SECRETS. A
 * comma-separated list, so a new secret can be added, rolled out to the
 * photobooth, and the old one removed, without a moment of downtime.
 */
export function configuredSecrets(raw = process.env.PHOTOBOOTH_API_SECRETS): string[] {
  return (raw ?? "")
    .split(",")
    .map((secret) => secret.trim())
    .filter((secret) => secret.length >= MIN_SECRET_LENGTH);
}

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Whether the request carries `Authorization: Bearer <secret>` for one of the
 * configured secrets. Fails closed: with no secret configured, nothing passes.
 *
 * Compares SHA-256 digests in constant time and checks every secret even
 * after a match, so neither the timing nor the secrets' lengths leak.
 */
export function isAuthorized(header: string | null, secrets = configuredSecrets()): boolean {
  const match = /^Bearer (.+)$/.exec(header ?? "");
  if (!match || secrets.length === 0) return false;

  const given = digest(match[1]!);
  let authorized = false;
  for (const secret of secrets) {
    if (timingSafeEqual(given, digest(secret))) authorized = true;
  }
  return authorized;
}

// ---------------------------------------------------------------------------
// Preorders
// ---------------------------------------------------------------------------

export const ORDER_NUMBER_PATTERN = /^PO-\d{4,}$/;

export function toPreorderV1(order: OrderWithItems): PreorderV1 {
  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    phoneLast4: lastFourDigits(order.customerPhone),
    status: order.status,
    paymentStatus: order.paymentStatus,
    pickupSlot: order.pickupSlot,
    items: order.items.map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
    })),
    createdAt: order.createdAt.toString(),
    updatedAt: order.updatedAt.toString(),
  };
}

/** A position in the (updatedAt, orderNumber) ordering of the change feed. */
export interface FeedCursor {
  updatedAt: Temporal.Instant;
  orderNumber: string;
}

/**
 * Opaque to the photobooth: it hands the value back unread. Encoded rather
 * than raw so its shape can change without a contract version.
 */
export function encodeCursor(cursor: FeedCursor): string {
  return Buffer.from(
    JSON.stringify({ u: cursor.updatedAt.toString(), n: cursor.orderNumber }),
  ).toString("base64url");
}

/** The cursor a client sent back, or null when it is not one of ours. */
export function decodeCursor(raw: string): FeedCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const { u, n } = parsed as Record<string, unknown>;
    if (typeof u !== "string" || typeof n !== "string" || !ORDER_NUMBER_PATTERN.test(n)) {
      return null;
    }
    return { updatedAt: Temporal.Instant.from(u), orderNumber: n };
  } catch {
    return null;
  }
}
