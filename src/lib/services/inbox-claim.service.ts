import { Temporal } from "@js-temporal/polyfill";
import { prisma as db } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";
import { CLAIM_MINUTES, isClaimLive, type StoredClaim } from "@/lib/inbox-claims";

/**
 * The claims behind "Saya yang tangani". A claim is one row per inbox item;
 * a lapsed one is as good as none, and is overwritten by the next claim.
 */

/** Every claim still live, with the claimant's name, for the inbox. */
export async function liveClaims(): Promise<StoredClaim[]> {
  const since = Temporal.Now.instant().subtract({ minutes: CLAIM_MINUTES });
  const rows = await db.orm.public.InboxClaim.where((claim) => claim.claimedAt.gt(since))
    .include("user")
    .all();
  return rows.map((row) => ({
    itemKey: row.itemKey,
    userId: row.userId,
    userName: row.user.name,
    claimedAt: row.claimedAt.toString(),
  }));
}

/**
 * Says `userId` has the item. Refused while somebody else's claim on it is
 * live, naming them, so two people never both think it is theirs. Claiming
 * again refreshes one's own claim.
 */
export async function claimItem(itemKey: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await tx.orm.public.InboxClaim.where({ itemKey }).include("user").first();
    const now = Temporal.Now.instant();
    if (existing && existing.userId !== userId && isClaimLive({ claimedAt: existing.claimedAt.toString() }, now.epochMilliseconds)) {
      throw new ValidationError(`Lagi ditangani ${existing.user.name}`);
    }
    if (existing) {
      await tx.orm.public.InboxClaim.where({ itemKey }).update({ userId, claimedAt: now });
    } else {
      await tx.orm.public.InboxClaim.create({ itemKey, userId, claimedAt: now });
    }
  });
}

/** Lets go of one's own claim. Nobody else's: a claim lapses by itself. */
export async function releaseItem(itemKey: string, userId: string): Promise<void> {
  await db.orm.public.InboxClaim.where({ itemKey, userId }).deleteAll();
}

/** Claims on items no longer in anyone's inbox, or long lapsed: dropped. */
export async function pruneClaims(currentKeys: readonly string[]): Promise<void> {
  const since = Temporal.Now.instant().subtract({ minutes: CLAIM_MINUTES });
  const rows = await db.orm.public.InboxClaim.all();
  const keep = new Set(currentKeys);
  const stale = rows
    .filter((row) => !keep.has(row.itemKey) || Temporal.Instant.compare(row.claimedAt, since) <= 0)
    .map((row) => row.itemKey);
  if (stale.length > 0) await db.orm.public.InboxClaim.where((claim) => claim.itemKey.in(stale)).deleteAll();
}
