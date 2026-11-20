import type { ActionResult } from "@/lib/action-result";
import { shrinkImage } from "@/lib/shrink-image";

/** Wide enough for a card on a desktop, small enough for the booth's signal. */
export const ADMIN_PHOTO_MAX_EDGE = 1200;

/**
 * Sends one photo for a menu item or a paket: shrunk in the browser to at most
 * 1200 px, as JPEG, to the upload route, which checks the bytes itself. Never
 * throws: a dropped connection comes back as a failed result to show.
 */
export async function uploadAdminPhoto<T>(endpoint: string, file: File, name: string): Promise<ActionResult<T>> {
  try {
    const shrunk = await shrinkImage(file, { maxEdge: ADMIN_PHOTO_MAX_EDGE, type: "image/jpeg", quality: 0.82 });
    const form = new FormData();
    form.append("file", shrunk, name);
    const response = await fetch(endpoint, { method: "POST", body: form });
    return (await response.json()) as ActionResult<T>;
  } catch {
    return { ok: false, error: "Fotonya gagal terkirim. Cek sinyal, lalu coba lagi" };
  }
}

/**
 * Sends photos one after another, as they were chosen (the first becomes the
 * cover), and stops at the first failure. Returns how many went, and the
 * failure if one stopped it.
 */
export async function uploadAdminPhotos(
  endpoint: string,
  files: readonly File[],
  onProgress?: (sent: number) => void,
): Promise<{ sent: number; error: string | null }> {
  let sent = 0;
  for (const file of files) {
    onProgress?.(sent);
    const result = await uploadAdminPhoto(endpoint, file, "foto.jpg");
    if (!result.ok) return { sent, error: result.error };
    sent += 1;
  }
  return { sent, error: null };
}
