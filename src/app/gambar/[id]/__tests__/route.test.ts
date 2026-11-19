import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ user: null as { id: string; role: string } | null }));
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => session.user }));

import { GET } from "@/app/gambar/[id]/route";
import { prisma as db } from "@/lib/prisma";
import { closeDatabase, resetDatabase } from "@/lib/services/__tests__/helpers/test-db";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

async function store(kind: "QRIS" | "PAYMENT_PROOF" | "PRODUCT") {
  return await db.orm.public.StoredImage.create({ kind, mimeType: "image/png", data: PNG, byteSize: PNG.length });
}

const get = (id: string) => GET(new Request(`http://test/gambar/${id}`), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  await resetDatabase();
  session.user = null;
});

afterAll(async () => {
  await closeDatabase();
});

describe("GET /gambar/[id]", () => {
  it("serves the booth's QRIS to anyone, cached for good, and never as something runnable", async () => {
    const qris = await store("QRIS");
    const response = await get(qris.id);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });

  it("serves a menu photo to anyone, cached for good by the browser and the CDN", async () => {
    const photo = await store("PRODUCT");
    const response = await get(photo.id);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, s-maxage=31536000, immutable");
  });

  it("shows a payment proof only to the till, and to nobody else says it exists", async () => {
    const proof = await store("PAYMENT_PROOF");

    expect((await get(proof.id)).status).toBe(404);
    session.user = { id: "u1", role: "DAPUR" };
    expect((await get(proof.id)).status).toBe(404);

    session.user = { id: "u2", role: "KASIR" };
    const seen = await get(proof.id);
    expect(seen.status).toBe(200);
    expect(seen.headers.get("cache-control")).toBe("private, no-store");
  });

  it("answers 404 for an unknown or malformed id", async () => {
    expect((await get("00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await get("../etc/passwd")).status).toBe(404);
  });
});
