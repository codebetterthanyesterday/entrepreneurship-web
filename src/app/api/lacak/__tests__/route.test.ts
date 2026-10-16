import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const { GET } = await import("@/app/api/lacak/route");
const { createOrder } = await import("@/lib/services/order.service");
const { claimLinkToken } = await import("@/lib/photobooth-link");
const { closeDatabase, makePickupSlot, makeProduct, resetDatabase } =
  await import("@/lib/services/__tests__/helpers/test-db");

const SECRET = "rahasia-tautan-klaim-0123456789abcdef";

async function track(no: string, wa: string) {
  const response = await GET(
    new Request(`http://localhost/api/lacak?no=${encodeURIComponent(no)}&wa=${wa}`),
  );
  return (await response.json()) as { order: unknown; photoLink?: string | null };
}

beforeAll(() => {
  process.env.PHOTOBOOTH_URL = "https://bunnye-photobooth.vercel.app";
  process.env.PHOTOBOOTH_CLAIM_LINK_SECRET = SECRET;
});

afterAll(async () => {
  delete process.env.PHOTOBOOTH_URL;
  delete process.env.PHOTOBOOTH_CLAIM_LINK_SECRET;
  await closeDatabase();
});

let orderNumber: string;

beforeEach(async () => {
  await resetDatabase();
  const kopi = await makeProduct({ name: "Es Kopi Aren", stock: 10 });
  await makePickupSlot("09.00 - 10.00", 10);
  const order = await createOrder({
    channel: "PREORDER",
    items: [{ productId: kopi.id, quantity: 1 }],
    customerName: "Nadia Prameswari",
    customerPhone: "081234560042",
    pickupSlot: "09.00 - 10.00",
    paymentMethod: "CASH",
    paymentStatus: "UNPAID",
  });
  orderNumber = order.orderNumber;
});

describe("tracking and the photobooth link", () => {
  it("gives a visitor who proved the digits a link that opens the photos directly", async () => {
    const body = await track(orderNumber, "0042");

    const link = new URL(body.photoLink!);
    expect(link.origin + link.pathname).toBe("https://bunnye-photobooth.vercel.app/foto");
    expect(link.searchParams.get("kode")).toBe(orderNumber);
    expect(link.searchParams.get("t")).toBe(claimLinkToken(orderNumber, SECRET));
  });

  it("gives nothing at all to a visitor with the wrong digits", async () => {
    const body = await track(orderNumber, "0000");

    expect(body).toEqual({ order: null });
  });
});
