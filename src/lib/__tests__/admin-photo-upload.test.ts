// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shrink-image", () => ({ shrinkImage: async (file: File) => file }));
const { uploadAdminPhoto, uploadAdminPhotos } = await import("@/lib/admin-photo-upload");

const photo = (name: string) => new File(["x"], name, { type: "image/jpeg" });
const answer = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)));

afterEach(() => vi.unstubAllGlobals());

describe("uploading a new item's photos", () => {
  it("sends them in the order picked, so the first becomes the cover", async () => {
    const sent: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(((init.body as FormData).get("file") as File).name);
      return answer({ ok: true, data: { id: "i" } });
    }));

    const result = await uploadAdminPhotos("/api/admin/produk/p1/foto", [photo("a.jpg"), photo("b.jpg")]);

    expect(result).toEqual({ sent: 2, error: null });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe("/api/admin/produk/p1/foto");
  });

  it("stops at the first refusal and says how many went", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => answer({ ok: true, data: { id: "i" } }))
      .mockImplementationOnce(() => answer({ ok: false, error: "Itu bukan gambar" })));

    const result = await uploadAdminPhotos("/x", [photo("a.jpg"), photo("b.jpg"), photo("c.jpg")]);

    expect(result).toEqual({ sent: 1, error: "Itu bukan gambar" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("turns a dropped connection into a message instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));

    const result = await uploadAdminPhoto("/x", photo("a.jpg"), "paket.jpg");

    expect(result).toEqual({ ok: false, error: "Fotonya gagal terkirim. Cek sinyal, lalu coba lagi" });
  });
});
