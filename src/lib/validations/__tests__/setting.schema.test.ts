import { describe, expect, it } from "vitest";
import { updateSettingsSchema } from "@/lib/validations/setting.schema";

const instagram = (value: string) => updateSettingsSchema.safeParse({ instagram: value });

describe("the Instagram account in Pengaturan", () => {
  it("takes it however it is pasted, and keeps the bare handle", () => {
    for (const pasted of ["bunnye.id", "@bunnye.id", "https://www.instagram.com/bunnye.id/", "instagram.com/bunnye.id?igsh=abc"]) {
      const result = instagram(pasted);
      expect(result.success && result.data.instagram, pasted).toBe("bunnye.id");
    }
  });

  it("refuses what cannot be an Instagram handle", () => {
    const result = instagram("bunny e!");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["instagram"]);
  });

  it("accepts empty, which takes the link out of the footer", () => {
    const result = instagram("  ");
    expect(result.success && result.data.instagram).toBe("");
  });
});

describe("the brand name and tagline", () => {
  it("are trimmed and kept short enough for the header", () => {
    const ok = updateSettingsSchema.safeParse({ brandName: "  Kedai Kelinci  ", tagline: "Kopi hangat" });
    expect(ok.success && ok.data).toMatchObject({ brandName: "Kedai Kelinci", tagline: "Kopi hangat" });

    expect(updateSettingsSchema.safeParse({ brandName: "x".repeat(41) }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ tagline: "x".repeat(91) }).success).toBe(false);
  });
});
