import type { InboxItem } from "@/lib/inbox";

/**
 * "Saya yang tangani" (inbox phase 3): one person says they have an item, so
 * a second cashier does not do the same thing. A claim lasts this long, then
 * lapses by itself, so an item somebody walked away from comes back to all.
 */
export const CLAIM_MINUTES = 15;

export interface StoredClaim {
  itemKey: string;
  userId: string;
  userName: string;
  /** ISO. */
  claimedAt: string;
}

export function isClaimLive(claim: Pick<StoredClaim, "claimedAt">, now: number): boolean {
  return now - new Date(claim.claimedAt).getTime() < CLAIM_MINUTES * 60_000;
}

/** The items with whoever has them, for the person `viewerId`. Lapsed claims are ignored. */
export function withClaims(
  items: readonly InboxItem[],
  claims: readonly StoredClaim[],
  viewerId: string,
  now: number,
): InboxItem[] {
  const live = new Map(claims.filter((claim) => isClaimLive(claim, now)).map((claim) => [claim.itemKey, claim]));
  return items.map((item) => {
    const claim = live.get(item.key);
    if (!claim) return item;
    return { ...item, claim: { by: claim.userName, mine: claim.userId === viewerId, at: claim.claimedAt } };
  });
}

/** What still waits for this person: not "Pantau", and not taken by somebody else. */
export function isOpenForMe(item: InboxItem): boolean {
  return item.tone !== "watch" && !(item.claim && !item.claim.mine);
}
