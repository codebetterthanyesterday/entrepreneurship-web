import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ role: null as string | null }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/session", async () => {
  const { ForbiddenError, UnauthorizedError } = await import("@/lib/errors");
  return {
    requireRole: async (...roles: string[]) => {
      if (!session.role) throw new UnauthorizedError();
      if (!roles.includes(session.role)) throw new ForbiddenError();
      return { id: "u1", role: session.role };
    },
  };
});

const { POST } = await import("@/app/api/admin/produk/[id]/foto/route");
const { prisma: db } = await import("@/lib/prisma");
const { closeDatabase, makeProduct, resetDatabase } = await import("@/lib/services/__tests__/helpers/test-db");

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

function upload(productId: string, bytes: Uint8Array<ArrayBuffer> = JPEG) {
  const form = new FormData();
  form.append("file", new File([bytes], "foto.jpg", { type: "image/jpeg" }));
  return POST(new Request("http://test/api/admin/produk/x/foto", { method: "POST", body: form }), {
    params: Promise.resolve({ id: productId }),
  });
}

beforeEach(async () => {
  await resetDatabase();
  session.role = "ADMIN";
});

afterAll(async () => {
  await closeDatabase();
});

describe("POST /api/admin/produk/[id]/foto", () => {
  it("adds an admin's photo and makes it the cover of a product that had none", async () => {
    const product = await makeProduct();

    const response = await upload(product.id);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.url).toMatch(/^\/gambar\//);
    expect((await db.orm.public.Product.where({ id: product.id }).first())!.imageUrl).toBe(body.data.url);
  });

  it("refuses anyone who is not an admin, and someone signed out", async () => {
    const product = await makeProduct();

    session.role = "KASIR";
    expect((await upload(product.id)).status).toBe(403);
    session.role = null;
    expect((await upload(product.id)).status).toBe(401);
    expect(await db.orm.public.ProductImage.all()).toHaveLength(0);
  });

  it("says why a file that is not a picture is refused", async () => {
    const product = await makeProduct();

    const response = await upload(product.id, new TextEncoder().encode("bukan foto"));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/bukan gambar/);
  });
});
