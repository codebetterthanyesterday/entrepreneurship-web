import { createHmac } from "node:crypto";
import { prisma as db } from "@/lib/prisma";

/**
 * Rate limits for the public endpoints, counted in the `rateLimit` table.
 *
 * Without them one script could place preorders without end, and every one of
 * them holds stock and a slot's quota until staff cancel it: the menu would
 * read "habis" for every real customer. The same script could keep uploading
 * payment proofs, walk the four WhatsApp digits of an older sequential order
 * number on the tracker (10,000 tries), or guess staff passwords.
 *
 * Each limit is a fixed window per key: `max` requests in `windowSeconds`,
 * counted by one atomic upsert in PostgreSQL, so concurrent requests on any
 * number of function instances share one count. Keys are a keyed hash of the
 * subject (an IP address, a phone number, an email), never the subject itself.
 *
 * The numbers are set for a campus crowd, where many phones share one IP
 * behind the campus Wi-Fi: generous per address, tight per phone or per
 * order, where one real customer never comes close.
 *
 * A limiter that cannot reach the database lets the request through: the
 * order itself needs the same database and fails on its own, and a broken
 * counter must never be what turns customers away.
 */

export interface RateLimit {
  /** Part of the key, and what the log calls it. */
  name: string;
  max: number;
  windowSeconds: number;
}

const MINUTE = 60;

export const LIMITS = {
  /** Preorders from one address. A crowd on one Wi-Fi stays far below this. */
  checkoutPerIp: { name: "checkout-ip", max: 30, windowSeconds: 15 * MINUTE },
  /** Preorders for one WhatsApp number. Nobody orders six times in an hour. */
  checkoutPerPhone: { name: "checkout-phone", max: 5, windowSeconds: 60 * MINUTE },
  /** Payment-proof uploads from one address. */
  proofPerIp: { name: "proof-ip", max: 20, windowSeconds: 10 * MINUTE },
  /** Payment-proof uploads for one order: a retake or two, not a flood. */
  proofPerOrder: { name: "proof-order", max: 6, windowSeconds: 10 * MINUTE },
  /** Tracker lookups that found nothing, from one address. Polling a found order is never counted. */
  trackMissPerIp: { name: "track-miss-ip", max: 20, windowSeconds: 15 * MINUTE },
  /** Tracker lookups that found nothing, for one order number: the 4-digit guess. */
  trackMissPerOrder: { name: "track-miss-order", max: 8, windowSeconds: 15 * MINUTE },
  /** Failed staff sign-ins for one email. */
  loginFailPerEmail: { name: "login-email", max: 8, windowSeconds: 15 * MINUTE },
  /** Failed staff sign-ins from one address. */
  loginFailPerIp: { name: "login-ip", max: 30, windowSeconds: 15 * MINUTE },
} as const satisfies Record<string, RateLimit>;

export interface RateLimitState {
  /** Whether this request may go ahead. */
  allowed: boolean;
  /** Seconds until the window resets; 0 when allowed and nothing is counted yet. */
  retryAfterSeconds: number;
}

/** Old windows are swept on roughly one counted request in fifty. */
const SWEEP_CHANCE = 0.02;

function keyFor(limit: RateLimit, subject: string): string {
  // Keyed, so the table cannot be reversed into IP addresses or phone numbers
  // by hashing every candidate.
  const digest = createHmac("sha256", process.env.AUTH_SECRET ?? "ngd-rate-limit")
    .update(subject.trim().toLowerCase())
    .digest("base64url")
    .slice(0, 32);
  return `${limit.name}:${digest}`;
}

/**
 * Counts one request against `limit` for `subject` and says whether it is
 * within it. The request that goes over is refused, and so is every one after
 * it until the window resets.
 */
export async function hitRateLimit(limit: RateLimit, subject: string): Promise<RateLimitState> {
  const key = keyFor(limit, subject);
  const seconds = limit.windowSeconds;
  try {
    const plan = db.raw.sql`
      INSERT INTO "public"."rateLimit" ("key", "windowStart", "count")
      VALUES (${key}, now(), 1)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "rateLimit"."windowStart" <= now() - make_interval(secs => ${seconds}::double precision) THEN 1
          ELSE "rateLimit"."count" + 1
        END,
        "windowStart" = CASE
          WHEN "rateLimit"."windowStart" <= now() - make_interval(secs => ${seconds}::double precision) THEN now()
          ELSE "rateLimit"."windowStart"
        END
      RETURNING "count",
        GREATEST(0, CEIL(EXTRACT(EPOCH FROM ("windowStart" + make_interval(secs => ${seconds}::double precision) - now()))))::int AS "retryAfter"
    `
      .returnsRow({ count: "pg/int4@1", retryAfter: "pg/int4@1" })
      .build();
    const [row] = await db.runtime().query(plan);
    if (Math.random() < SWEEP_CHANCE) void sweep();
    const count = row?.count ?? 1;
    return { allowed: count <= limit.max, retryAfterSeconds: row?.retryAfter ?? seconds };
  } catch (error) {
    console.error(`rate limit ${limit.name}: counter unavailable, letting the request through`, error);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/**
 * Whether `subject` is already over `limit`, without counting anything. For
 * limits that count only failures: check first, and `hitRateLimit` only when
 * the attempt fails.
 */
export async function checkRateLimit(limit: RateLimit, subject: string): Promise<RateLimitState> {
  const key = keyFor(limit, subject);
  const seconds = limit.windowSeconds;
  try {
    const plan = db.raw.sql`
      SELECT "count",
        GREATEST(0, CEIL(EXTRACT(EPOCH FROM ("windowStart" + make_interval(secs => ${seconds}::double precision) - now()))))::int AS "retryAfter"
      FROM "public"."rateLimit"
      WHERE "key" = ${key}
        AND "windowStart" > now() - make_interval(secs => ${seconds}::double precision)
    `
      .returnsRow({ count: "pg/int4@1", retryAfter: "pg/int4@1" })
      .build();
    const [row] = await db.runtime().query(plan);
    if (!row) return { allowed: true, retryAfterSeconds: 0 };
    return { allowed: row.count < limit.max, retryAfterSeconds: row.retryAfter };
  } catch (error) {
    console.error(`rate limit ${limit.name}: counter unavailable, letting the request through`, error);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

async function sweep(): Promise<void> {
  try {
    await db.runtime().execute(
      db.raw.sql`DELETE FROM "public"."rateLimit" WHERE "windowStart" < now() - interval '1 day'`
        .affectedCount()
        .build(),
    );
  } catch {
    // The next sweep gets it.
  }
}

/** "15 menit", "1 menit": how long to wait, for a message to a person. */
export function waitLabel(seconds: number): string {
  return `${Math.max(1, Math.ceil(seconds / 60))} menit`;
}
