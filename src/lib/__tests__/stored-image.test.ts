import { describe, expect, it } from "vitest";
import { imageIdOf, imagePath, sniffImage } from "@/lib/stored-image";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

describe("sniffImage: the type comes from the content, not the name", () => {
  it("knows a PNG, a JPEG and a WebP by their first bytes", () => {
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImage(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))).toBe("image/webp");
  });

  it("refuses anything else, an SVG or a script renamed .png included", () => {
    expect(sniffImage(bytes(...ascii("<svg xmlns=")))).toBeNull();
    expect(sniffImage(bytes(...ascii("<script>alert(1)")))).toBeNull();
    expect(sniffImage(bytes(...ascii("GIF89a")))).toBeNull();
    expect(sniffImage(bytes())).toBeNull();
  });
});

describe("imagePath and imageIdOf", () => {
  const id = "3f2b6c1e-9a4d-4c2b-8e1f-0a1b2c3d4e5f";

  it("round-trip an id through its address", () => {
    expect(imageIdOf(imagePath(id))).toBe(id);
  });

  it("do not claim a link pasted from elsewhere", () => {
    expect(imageIdOf("https://example.com/qris.png")).toBeNull();
    expect(imageIdOf(`/gambar/${id}/../x`)).toBeNull();
    expect(imageIdOf(null)).toBeNull();
  });
});
