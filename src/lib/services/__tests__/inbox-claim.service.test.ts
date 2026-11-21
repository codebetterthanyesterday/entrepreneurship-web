import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { claimItem, liveClaims, pruneClaims, releaseItem } from "@/lib/services/inbox-claim.service";
import { closeDatabase, db, makeUser, resetDatabase } from "./helpers/test-db";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

const KEY = "qris-proof:PO-7KX4QM";

describe("inbox claims", () => {
  it("lets one person take an item, and refuses a second while it is theirs, naming them", async () => {
    const farel = await makeUser("KASIR");
    const rani = await makeUser("KASIR");

    await claimItem(KEY, farel.id);
    await expect(claimItem(KEY, rani.id)).rejects.toThrow(`Lagi ditangani ${farel.name}`);

    // Claiming again refreshes one's own claim.
    await claimItem(KEY, farel.id);
    expect((await liveClaims()).map((claim) => [claim.itemKey, claim.userName])).toEqual([[KEY, farel.name]]);
  });

  it("hands a lapsed claim to whoever takes the item next", async () => {
    const farel = await makeUser("KASIR");
    const rani = await makeUser("KASIR");
    await claimItem(KEY, farel.id);
    await db.orm.public.InboxClaim.where({ itemKey: KEY }).update({
      claimedAt: Temporal.Now.instant().subtract({ minutes: 20 }),
    });

    expect(await liveClaims()).toEqual([]);
    await claimItem(KEY, rani.id);
    expect((await liveClaims())[0]?.userId).toBe(rani.id);
  });

  it("lets a person go of their own claim only", async () => {
    const farel = await makeUser("KASIR");
    const rani = await makeUser("KASIR");
    await claimItem(KEY, farel.id);

    await releaseItem(KEY, rani.id);
    expect(await liveClaims()).toHaveLength(1);
    await releaseItem(KEY, farel.id);
    expect(await liveClaims()).toEqual([]);
  });

  it("drops claims on items no longer in any inbox", async () => {
    const farel = await makeUser("KASIR");
    await claimItem(KEY, farel.id);
    await claimItem("ready:PO-GONE", farel.id);

    await pruneClaims([KEY]);

    expect((await liveClaims()).map((claim) => claim.itemKey)).toEqual([KEY]);
  });
});
