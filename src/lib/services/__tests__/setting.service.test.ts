import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getSettings, updateSettings } from "@/lib/services/setting.service";
import { closeDatabase, resetDatabase } from "./helpers/test-db";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("accentChoiceEnabled", () => {
  it("is on for a fresh store, so the feature behaves as it did before the switch", async () => {
    expect((await getSettings()).accentChoiceEnabled).toBe(true);
  });

  it("is turned off and on by the admin without touching the other settings", async () => {
    const before = await getSettings();

    await updateSettings({ accentChoiceEnabled: false });
    const off = await getSettings();
    expect(off.accentChoiceEnabled).toBe(false);
    expect(off.preorderOpen).toBe(before.preorderOpen);
    expect(off.boothOpen).toBe(before.boothOpen);

    await updateSettings({ accentChoiceEnabled: true });
    expect((await getSettings()).accentChoiceEnabled).toBe(true);
  });
});
