import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma as db } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { attachPaymentProof, clearQrisImage, setQrisImage } from "@/lib/services/image.service";
import { createOrder, markAsPaid } from "@/lib/services/order.service";
import { getSettings } from "@/lib/services/setting.service";
import { findStoredImage } from "@/lib/queries/image.query";
import { imageIdOf } from "@/lib/stored-image";
import { closeDatabase, makeProduct, makeUser, openPreorderWindow, resetDatabase } from "./helpers/test-db";

/** A tiny but real PNG header followed by filler: enough for the type check. */
const png = (filler = 1) =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(16).fill(filler)]);
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);

beforeEach(async () => {
  await resetDatabase();
  // The settings row is not truncated with the rest; start each test without a QRIS.
  await getSettings();
  await db.orm.public.StoreSetting.where({ id: 1 }).update({ qrisImageUrl: null });
});

afterAll(async () => {
  await closeDatabase();
});

async function preorder(paymentMethod: "CASH" | "QRIS") {
  const product = await makeProduct({ stock: 10 });
  return await createOrder({
    channel: "PREORDER",
    paymentStatus: "UNPAID",
    customerName: "Rani",
    customerPhone: "081234561234",
    schedule: await openPreorderWindow("09.00 - 10.00", 10),
    paymentMethod,
    items: [{ productId: product.id, quantity: 1 }],
  });
}

describe("the booth's QRIS", () => {
  it("is stored in the database and put into the settings as its own address", async () => {
    const { url } = await setQrisImage(png());

    expect((await getSettings()).qrisImageUrl).toBe(url);
    const stored = await findStoredImage(imageIdOf(url)!);
    expect(stored).toMatchObject({ kind: "QRIS", mimeType: "image/png", byteSize: 24 });
  });

  it("replacing it deletes the old picture, so only one is ever kept", async () => {
    const first = await setQrisImage(png(1));
    const second = await setQrisImage(png(2));

    expect(await findStoredImage(imageIdOf(first.url)!)).toBeNull();
    expect(await findStoredImage(imageIdOf(second.url)!)).not.toBeNull();
    expect(await db.orm.public.StoredImage.all()).toHaveLength(1);
  });

  it("refuses what is not a picture, whatever its name, and anything over 3 MB", async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    await expect(setQrisImage(svg)).rejects.toBeInstanceOf(ValidationError);

    const huge = new Uint8Array(3 * 1024 * 1024 + 1);
    huge.set(png());
    await expect(setQrisImage(huge)).rejects.toBeInstanceOf(ValidationError);
    expect((await getSettings()).qrisImageUrl ?? null).toBeNull();
  });

  it("taken down, it leaves no picture behind", async () => {
    await setQrisImage(png());
    await clearQrisImage();

    expect((await getSettings()).qrisImageUrl).toBeNull();
    expect(await db.orm.public.StoredImage.all()).toHaveLength(0);
  });

  it("must exist before a customer can choose to pay by QRIS", async () => {
    await getSettings();
    await expect(preorder("QRIS")).rejects.toMatchObject({ field: "paymentMethod" });

    await setQrisImage(png());
    await expect(preorder("QRIS")).resolves.toMatchObject({ paymentMethod: "QRIS" });
  });
});

describe("a QRIS payment proof", () => {
  beforeEach(async () => {
    await setQrisImage(png());
  });

  it("is attached to the order with its number and the last four WhatsApp digits", async () => {
    const order = await preorder("QRIS");

    const { url } = await attachPaymentProof({
      orderNumber: order.orderNumber,
      phoneLast4: "1234",
      bytes: jpeg(),
    });

    const saved = await db.orm.public.Order.where({ id: order.id }).first();
    expect(saved?.paymentProofUrl).toBe(url);
    expect(saved?.paymentStatus).toBe("UNPAID");
    expect(await findStoredImage(imageIdOf(url)!)).toMatchObject({ kind: "PAYMENT_PROOF" });
  });

  it("answers the same 'not found' for a wrong number and for wrong digits", async () => {
    const order = await preorder("QRIS");

    await expect(
      attachPaymentProof({ orderNumber: order.orderNumber, phoneLast4: "9999", bytes: jpeg() }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      attachPaymentProof({ orderNumber: "PO-9999", phoneLast4: "1234", bytes: jpeg() }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("sent again, replaces the first one", async () => {
    const order = await preorder("QRIS");
    const proof = { orderNumber: order.orderNumber, phoneLast4: "1234" };

    const first = await attachPaymentProof({ ...proof, bytes: jpeg() });
    const second = await attachPaymentProof({ ...proof, bytes: jpeg() });

    expect(await findStoredImage(imageIdOf(first.url)!)).toBeNull();
    expect(await findStoredImage(imageIdOf(second.url)!)).not.toBeNull();
  });

  it("is not taken for a cash order or one already paid", async () => {
    const cash = await preorder("CASH");
    await expect(
      attachPaymentProof({ orderNumber: cash.orderNumber, phoneLast4: "1234", bytes: jpeg() }),
    ).rejects.toBeInstanceOf(ValidationError);

    const qris = await preorder("QRIS");
    const cashier = await makeUser("KASIR");
    await markAsPaid(qris.id, { id: cashier.id, role: "KASIR" });
    await expect(
      attachPaymentProof({ orderNumber: qris.orderNumber, phoneLast4: "1234", bytes: jpeg() }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
