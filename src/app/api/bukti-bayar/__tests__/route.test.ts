import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/bukti-bayar/route";
import { prisma as db } from "@/lib/prisma";
import { createOrder } from "@/lib/services/order.service";
import { getSettings } from "@/lib/services/setting.service";
import { closeDatabase, makeProduct, openPreorderWindow, resetDatabase } from "@/lib/services/__tests__/helpers/test-db";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);

function post(fields: { no: string; wa: string; file?: Uint8Array }) {
  const form = new FormData();
  form.append("no", fields.no);
  form.append("wa", fields.wa);
  if (fields.file) {
    form.append("file", new File([fields.file.slice().buffer as ArrayBuffer], "bukti.jpg", { type: "image/jpeg" }));
  }
  return POST(new Request("http://test/api/bukti-bayar", { method: "POST", body: form }));
}

beforeEach(async () => {
  await resetDatabase();
  await getSettings();
  await db.orm.public.StoreSetting.where({ id: 1 }).update({
    qrisImageUrl: "/gambar/00000000-0000-4000-8000-000000000000",
  });
});

afterAll(async () => {
  await closeDatabase();
});

async function qrisOrder() {
  const product = await makeProduct({ stock: 5 });
  return await createOrder({
    channel: "PREORDER",
    paymentStatus: "UNPAID",
    customerName: "Rani",
    customerPhone: "081234561234",
    schedule: await openPreorderWindow("09.00 - 10.00", 10),
    paymentMethod: "QRIS",
    items: [{ productId: product.id, quantity: 1 }],
  });
}

describe("POST /api/bukti-bayar", () => {
  it("attaches the proof with the order number and the last four WhatsApp digits", async () => {
    const order = await qrisOrder();
    const response = await post({ no: order.orderNumber, wa: "1234", file: JPEG });

    expect(response.status).toBe(200);
    const saved = await db.orm.public.Order.where({ id: order.id }).first();
    expect(saved?.paymentProofUrl).toMatch(/^\/gambar\//);
    expect(saved?.paymentStatus).toBe("UNPAID");
  });

  it("gives one answer for a wrong number and wrong digits", async () => {
    const order = await qrisOrder();
    const wrongDigits = await (await post({ no: order.orderNumber, wa: "0000", file: JPEG })).json();
    const wrongNumber = await (await post({ no: "PO-9999", wa: "1234", file: JPEG })).json();

    expect(wrongDigits).toEqual(wrongNumber);
    expect(wrongDigits.ok).toBe(false);
  });

  it("asks for a file when none is sent", async () => {
    const order = await qrisOrder();
    const body = await (await post({ no: order.orderNumber, wa: "1234" })).json();
    expect(body).toMatchObject({ ok: false, field: "file" });
  });
});
