/**
 * Images uploaded through the app — the booth's QRIS and customers' payment
 * proofs — kept in the database (`StoredImage`) and served from `/gambar/<id>`.
 *
 * Pure, so the rules are tested without a database or a browser.
 */

/** What the browser is allowed to send, after it has shrunk the picture. */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export type ImageMime = "image/png" | "image/jpeg" | "image/webp";

/**
 * The image type, read from the file's first bytes rather than from its name
 * or the type the browser claims: both are whatever the sender says they are.
 * Anything that is not a PNG, JPEG or WebP is `null`.
 */
export function sniffImage(bytes: Uint8Array): ImageMime | null {
  const at = (index: number) => bytes[index];
  if (bytes.length >= 8 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/** Where a stored image is served. A new upload is a new id, so a new address. */
export function imagePath(id: string): string {
  return `/gambar/${id}`;
}

const PATH = /^\/gambar\/([0-9a-f-]{36})$/;

/** The id behind an address this app made, or `null` for anything else (an old pasted link). */
export function imageIdOf(url: string | null | undefined): string | null {
  return url ? (PATH.exec(url)?.[1] ?? null) : null;
}
