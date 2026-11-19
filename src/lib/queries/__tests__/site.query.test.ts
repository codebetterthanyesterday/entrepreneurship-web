import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma as db } from "@/lib/prisma";
import { BRAND_NAME } from "@/lib/brand";
import { DEFAULT_TAGLINE, getSiteIdentity } from "@/lib/queries/site.query";
import { updateSettings } from "@/lib/services/setting.service";
import { closeDatabase, resetDatabase } from "@/lib/services/__tests__/helpers/test-db";

beforeEach(async () => {
  await resetDatabase();
  await db.orm.public.SiteText.where((row) => row.key.in(["hero.title", "footer.tagline", "contact.instagram"])).deleteAll();
});

afterAll(async () => {
  await closeDatabase();
});

describe("the store's identity", () => {
  it("is the default until the admin writes one", async () => {
    expect(await getSiteIdentity()).toEqual({ brandName: BRAND_NAME, tagline: DEFAULT_TAGLINE, instagram: "" });
  });

  it("is what the admin saved in Pengaturan", async () => {
    await updateSettings({ brandName: "Kedai Kelinci", tagline: "Kopi hangat tiap Market Day", instagram: "kedai.kelinci" });

    expect(await getSiteIdentity()).toEqual({
      brandName: "Kedai Kelinci",
      tagline: "Kopi hangat tiap Market Day",
      instagram: "kedai.kelinci",
    });
  });

  it("falls back, field by field, to what the retired profile editor saved, then to the default", async () => {
    await db.orm.public.SiteText.create({ key: "hero.title", value: "Nama Lama", version: 1 });
    await db.orm.public.SiteText.create({ key: "contact.instagram", value: "@lama.id", version: 1 });
    await updateSettings({ instagram: "baru.id" });

    expect(await getSiteIdentity()).toEqual({ brandName: "Nama Lama", tagline: DEFAULT_TAGLINE, instagram: "baru.id" });
  });
});
