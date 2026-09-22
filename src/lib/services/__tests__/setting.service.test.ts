import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { getSettings, updateSettings, upsertPickupSlot } from "@/lib/services/setting.service";
import { createOrder } from "@/lib/services/order.service";
import {
  closeDatabase,
  makePickupSlot,
  makeProduct,
  resetDatabase,
  slotByLabel,
} from "./helpers/test-db";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("upsertPickupSlot", () => {
  it("refuses a quota cut below the places already booked", async () => {
    const product = await makeProduct({ stock: 50 });
    const slot = await makePickupSlot("09.00 - 10.00", 10);

    for (let i = 0; i < 3; i++) {
      await createOrder({
        channel: "PREORDER",
        paymentStatus: "UNPAID",
        pickupSlot: "09.00 - 10.00",
        customerName: "Pelanggan Uji",
        paymentMethod: "CASH",
        items: [{ productId: product.id, quantity: 1 }],
      });
    }

    await expect(
      upsertPickupSlot({ id: slot.id, label: slot.label, quota: 2 }),
    ).rejects.toBeInstanceOf(ValidationError);

    // The refusal leaves the slot exactly as it was.
    const unchanged = await slotByLabel("09.00 - 10.00");
    expect(unchanged.quota).toBe(10);
    expect(unchanged.booked).toBe(3);
  });

  it("allows a quota cut down to the places already booked", async () => {
    const product = await makeProduct({ stock: 50 });
    const slot = await makePickupSlot("09.00 - 10.00", 10);

    await createOrder({
      channel: "PREORDER",
      paymentStatus: "UNPAID",
      pickupSlot: "09.00 - 10.00",
      customerName: "Pelanggan Uji",
      paymentMethod: "CASH",
      items: [{ productId: product.id, quantity: 1 }],
    });

    const updated = await upsertPickupSlot({ id: slot.id, label: slot.label, quota: 1 });
    expect(updated.quota).toBe(1);

    // And the slot is now full.
    await expect(
      createOrder({
        channel: "PREORDER",
        paymentStatus: "UNPAID",
        pickupSlot: "09.00 - 10.00",
        customerName: "Pelanggan Uji",
        paymentMethod: "CASH",
        items: [{ productId: product.id, quantity: 1 }],
      }),
    ).rejects.toThrow(/udah penuh/);
  });

  it("starts a new slot empty", async () => {
    const created = await upsertPickupSlot({ label: "13.00 - 14.00", quota: 8 });
    expect(created.booked).toBe(0);
    expect(created.quota).toBe(8);
  });
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
