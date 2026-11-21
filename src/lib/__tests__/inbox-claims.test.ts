import { describe, expect, it } from "vitest";
import type { InboxItem } from "@/lib/inbox";
import { CLAIM_MINUTES, isClaimLive, isOpenForMe, withClaims } from "@/lib/inbox-claims";

const NOW = Date.parse("2026-11-22T05:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const item = (key: string, tone: InboxItem["tone"] = "urgent"): InboxItem => ({
  key,
  kind: "qris-proof",
  tone,
  title: "Bukti QRIS masuk",
  detail: key,
  since: ago(1),
  href: "/kasir/preorder",
  actionLabel: "Cek bukti",
});

describe("Saya yang tangani", () => {
  it(`lasts ${CLAIM_MINUTES} minutes, then lapses by itself`, () => {
    expect(isClaimLive({ claimedAt: ago(CLAIM_MINUTES - 1) }, NOW)).toBe(true);
    expect(isClaimLive({ claimedAt: ago(CLAIM_MINUTES) }, NOW)).toBe(false);
  });

  it("shows each item with who has it, “mine” for the viewer, and ignores lapsed claims", () => {
    const [a, b, c] = withClaims(
      [item("a"), item("b"), item("c")],
      [
        { itemKey: "a", userId: "u1", userName: "Farel", claimedAt: ago(2) },
        { itemKey: "b", userId: "me", userName: "Rani", claimedAt: ago(2) },
        { itemKey: "c", userId: "u1", userName: "Farel", claimedAt: ago(30) },
      ],
      "me",
      NOW,
    );
    expect(a!.claim).toEqual({ by: "Farel", mine: false, at: ago(2) });
    expect(b!.claim?.mine).toBe(true);
    expect(c!.claim).toBeUndefined();
  });

  it("leaves out of one's own count what a colleague has taken, and every “Pantau” item", () => {
    expect(isOpenForMe(item("free"))).toBe(true);
    expect(isOpenForMe({ ...item("taken"), claim: { by: "Farel", mine: false, at: ago(1) } })).toBe(false);
    expect(isOpenForMe({ ...item("mine"), claim: { by: "Rani", mine: true, at: ago(1) } })).toBe(true);
    expect(isOpenForMe(item("stock", "watch"))).toBe(false);
  });
});
