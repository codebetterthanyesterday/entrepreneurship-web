import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, StaleContentError } from "@/lib/errors";
import {
  deleteSiteListItem,
  moveSiteListItem,
  resetSiteText,
  saveSiteText,
  upsertSiteListItem,
} from "@/lib/services/site.service";
import { getSiteLists, getSiteTexts } from "@/lib/queries/site.query";
import { SITE_TEXT_DEFAULTS } from "@/lib/site-content";
import { closeDatabase, resetDatabase } from "./helpers/test-db";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

/**
 * The profile is edited straight on the live page by whoever is holding a phone,
 * which makes "two admins edit the same block" an ordinary Tuesday rather than a
 * theoretical race. Every write below is guarded by a predicate the database
 * evaluates, and these tests are what stops someone replacing that with a read
 * followed by a write.
 */
describe("saveSiteText", () => {
  it("serves the built-in default until a row exists", async () => {
    const texts = await getSiteTexts();

    expect(texts["hero.title"]).toEqual({
      key: "hero.title",
      value: SITE_TEXT_DEFAULTS["hero.title"],
      version: 0,
    });
  });

  it("creates the row on the first save and hands back version 1", async () => {
    const saved = await saveSiteText({ key: "hero.title", value: "Judul baru", version: 0 });

    expect(saved).toEqual({ key: "hero.title", value: "Judul baru", version: 1 });
    expect((await getSiteTexts())["hero.title"].value).toBe("Judul baru");
  });

  it("refuses a second save from an editor that was also looking at the default", async () => {
    await saveSiteText({ key: "hero.title", value: "Yang pertama", version: 0 });

    // Both admins loaded the page before either saved, so both hold version 0.
    // The second one must not silently replace the first one's text.
    await expect(
      saveSiteText({ key: "hero.title", value: "Yang kedua", version: 0 }),
    ).rejects.toBeInstanceOf(StaleContentError);

    expect((await getSiteTexts())["hero.title"].value).toBe("Yang pertama");
  });

  it("bumps the version on every accepted save", async () => {
    await saveSiteText({ key: "story.heading", value: "Satu", version: 0 });
    const second = await saveSiteText({ key: "story.heading", value: "Dua", version: 1 });

    expect(second.version).toBe(2);
  });

  it("refuses a save that carries a stale version, and reports the text that won", async () => {
    await saveSiteText({ key: "story.heading", value: "Satu", version: 0 });
    await saveSiteText({ key: "story.heading", value: "Dua", version: 1 });

    // This editor still has the page from before "Dua" was saved.
    const rejection = await saveSiteText({
      key: "story.heading",
      value: "Numpuk",
      version: 1,
    }).catch((error: unknown) => error);

    expect(rejection).toBeInstanceOf(StaleContentError);
    expect((rejection as StaleContentError).current).toBe("Dua");
    expect((await getSiteTexts())["story.heading"].value).toBe("Dua");
  });

  it("puts a block back to its default by dropping the row", async () => {
    await saveSiteText({ key: "hero.tagline", value: "Diubah", version: 0 });
    await resetSiteText("hero.tagline");

    const texts = await getSiteTexts();
    expect(texts["hero.tagline"].value).toBe(SITE_TEXT_DEFAULTS["hero.tagline"]);
    // Back to 0, so the next save is an insert again.
    expect(texts["hero.tagline"].version).toBe(0);
  });
});

describe("site lists", () => {
  it("appends a new item to the end of its own section", async () => {
    const first = await upsertSiteListItem({ section: "advantage", title: "Satu" });
    const second = await upsertSiteListItem({ section: "advantage", title: "Dua" });
    // A different section numbers itself independently.
    const other = await upsertSiteListItem({ section: "team", title: "Nadia" });

    expect(second.sortOrder).toBeGreaterThan(first.sortOrder);
    expect(other.sortOrder).toBe(1);
  });

  it("keeps each list to its own section", async () => {
    await upsertSiteListItem({ section: "advantage", title: "Keunggulan" });
    await upsertSiteListItem({ section: "team", title: "Nadia" });

    const lists = await getSiteLists();

    expect(lists.advantage.map((item) => item.title)).toEqual(["Keunggulan"]);
    expect(lists.team.map((item) => item.title)).toEqual(["Nadia"]);
    expect(lists.gallery).toEqual([]);
  });

  it("stores an empty optional field as null rather than an empty string", async () => {
    const item = await upsertSiteListItem({
      section: "gallery",
      title: "Booth kami",
      imageUrl: "",
      body: "   ",
    });

    expect(item.imageUrl).toBeNull();
    expect(item.body).toBeNull();
  });

  it("refuses an edit that carries a stale version", async () => {
    const item = await upsertSiteListItem({ section: "advantage", title: "Asli" });
    await upsertSiteListItem({
      id: item.id,
      section: "advantage",
      title: "Diubah",
      version: item.version,
    });

    await expect(
      upsertSiteListItem({
        id: item.id,
        section: "advantage",
        title: "Numpuk",
        version: item.version,
      }),
    ).rejects.toBeInstanceOf(StaleContentError);

    expect((await getSiteLists()).advantage[0]!.title).toBe("Diubah");
  });

  it("tells an editor when the item it is saving has already been deleted", async () => {
    const item = await upsertSiteListItem({ section: "team", title: "Nadia" });
    await deleteSiteListItem(item.id);

    await expect(
      upsertSiteListItem({
        id: item.id,
        section: "team",
        title: "Nadia",
        version: item.version,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("swaps two neighbours when an item is moved", async () => {
    const a = await upsertSiteListItem({ section: "advantage", title: "A" });
    const b = await upsertSiteListItem({ section: "advantage", title: "B" });
    const c = await upsertSiteListItem({ section: "advantage", title: "C" });

    await moveSiteListItem({ id: c.id, direction: "up" });
    expect((await getSiteLists()).advantage.map((item) => item.title)).toEqual(["A", "C", "B"]);

    await moveSiteListItem({ id: a.id, direction: "down" });
    expect((await getSiteLists()).advantage.map((item) => item.title)).toEqual(["C", "A", "B"]);

    expect(b.id).toBeTruthy();
  });

  it("treats a move past either end as a no-op instead of an error", async () => {
    const a = await upsertSiteListItem({ section: "advantage", title: "A" });
    await upsertSiteListItem({ section: "advantage", title: "B" });

    expect((await moveSiteListItem({ id: a.id, direction: "up" })).moved).toBe(false);
    expect((await getSiteLists()).advantage.map((item) => item.title)).toEqual(["A", "B"]);
  });

  it("never reorders across sections", async () => {
    // The first team member must not be able to swap places with an advantage
    // just because it happens to hold the neighbouring sortOrder.
    await upsertSiteListItem({ section: "advantage", title: "Keunggulan" });
    const member = await upsertSiteListItem({ section: "team", title: "Nadia" });

    expect((await moveSiteListItem({ id: member.id, direction: "up" })).moved).toBe(false);

    const lists = await getSiteLists();
    expect(lists.advantage.map((item) => item.title)).toEqual(["Keunggulan"]);
    expect(lists.team.map((item) => item.title)).toEqual(["Nadia"]);
  });
});
