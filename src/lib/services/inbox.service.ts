import { Temporal } from "@js-temporal/polyfill";
import { buildInbox, type InboxItem } from "@/lib/inbox";
import { withClaims } from "@/lib/inbox-claims";
import { loadInboxSnapshot } from "@/lib/queries/inbox.query";
import { liveClaims, pruneClaims } from "@/lib/services/inbox-claim.service";
import type { UserRole } from "@/types/order";

/**
 * One person's inbox, as `/inbox` and its API serve it: the items for their
 * role, each with whoever said "Saya yang tangani". Claims on items that have
 * gone from every inbox are dropped on the way.
 */
export async function inboxFor(user: { id: string; role: UserRole }): Promise<InboxItem[]> {
  const now = Temporal.Now.instant();
  const snapshot = await loadInboxSnapshot();
  const everyone = buildInbox(snapshot, "ADMIN", now);
  const [claims] = await Promise.all([liveClaims(), pruneClaims(everyone.map((item) => item.key))]);
  const mine = user.role === "ADMIN" ? everyone : buildInbox(snapshot, user.role, now);
  return withClaims(mine, claims, user.id, now.epochMilliseconds);
}
