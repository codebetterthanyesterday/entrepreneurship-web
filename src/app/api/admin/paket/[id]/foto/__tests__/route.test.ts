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

const { DELETE, POST } = await import("@/app/api/admin/paket/[id]/foto/route");
const { prisma: db } = await import("@/lib/prisma");
const { deleteBundle, updateBundle } = await import("@/lib/services/bundle.service");
const { closeDatabase, makeBundle, makeProduct, resetDatabase } = await import(
  "@/lib/services/__tests__/helpers/test-db"
);

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function upload(bundleId: string, bytes: Uint8Array<ArrayBuffer> = JPEG) {
  const form = new FormData();
  form.append("file", new File([bytes], "paket.jpg", { type: "image/jpeg" }));
  return POST(new Request("http://test/api/admin/paket/x/foto", { method: "POST", body: form }), params(bundleId));
}
const remove = (bundleId: string) =>
  DELETE(new Request("http://test/api/admin/paket/x/foto", { method: "DELETE" }), params(bundleId));

async function paket() {
  const product = await makeProduct();
  return { product, bundle: await makeBundle({ items: [{ productId: product.id, quantity: 2 }] }) };
}
const imageUrlOf = async (id: string) => (await db.orm.public.Bundle.where({ id }).first())!.imageUrl;
const storedCount = async () => (await db.orm.public.StoredImage.where({ kind: "BUNDLE" }).all()).length;

beforeEach(async () => {
  await resetDatabase();
  session.role = "ADMIN";
});

afterAll(async () => {
  await closeDatabase();
});

describe("a paket's cover photo", () => {
  it("is uploaded by an admin, served publicly, and replaced without leaving the old one behind", async () => {
    const { bundle } = await paket();

    const first = await (await upload(bundle.id)).json();
    expect(first.data.url).toMatch(/^\/gambar\//);
    expect(await imageUrlOf(bundle.id)).toBe(first.data.url);

    const second = await (await upload(bundle.id)).json();
    expect(await imageUrlOf(bundle.id)).toBe(second.data.url);
    expect(await storedCount()).toBe(1);
  });

  it("comes off with DELETE, and the catalogue draws the paket again", async () => {
    const { bundle } = await paket();
    await upload(bundle.id);

    expect((await remove(bundle.id)).status).toBe(200);
    expect(await imageUrlOf(bundle.id)).toBeNull();
    expect(await storedCount()).toBe(0);
  });

  it("is an admin's alone", async () => {
    const { bundle } = await paket();

    session.role = "KASIR";
    expect((await upload(bundle.id)).status).toBe(403);
    expect((await remove(bundle.id)).status).toBe(403);
    session.role = null;
    expect((await upload(bundle.id)).status).toBe(401);
    expect(await storedCount()).toBe(0);
  });

  it("says why a file that is not a picture is refused", async () => {
    const { bundle } = await paket();

    const response = await upload(bundle.id, new TextEncoder().encode("bukan foto"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/bukan gambar/);
  });

  it("stays when the paket's details are saved, and goes when the paket is deleted", async () => {
    const { bundle, product } = await paket();
    const { data } = await (await upload(bundle.id)).json();

    await updateBundle(bundle.id, {
      name: "Paket Baru",
      description: null,
      price: 30_000,
      isActive: true,
      sortOrder: 0,
      items: [{ productId: product.id, quantity: 1 }],
    });
    expect(await imageUrlOf(bundle.id)).toBe(data.url);

    await deleteBundle(bundle.id);
    expect(await storedCount()).toBe(0);
  });
});
