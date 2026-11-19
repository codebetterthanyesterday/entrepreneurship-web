import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BRAND_NAME } from "@/lib/brand";
import { DEFAULT_TAGLINE, getSiteIdentity } from "@/lib/queries/site.query";
import { updateSettings } from "@/lib/services/setting.service";
import { closeDatabase, resetDatabase } from "@/lib/services/__tests__/helpers/test-db";

beforeEach(async () => {
  await resetDatabase();
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

  it("falls back to the default for a field the admin left empty", async () => {
    await updateSettings({ brandName: "Kedai Kelinci", tagline: "", instagram: "@baru.id" });

    expect(await getSiteIdentity()).toEqual({ brandName: "Kedai Kelinci", tagline: DEFAULT_TAGLINE, instagram: "baru.id" });
  });
});
