/**
 * Reading a QR code off a live camera, in the browser.
 *
 * The same approach as the photobooth crew's scanner (entrepreneur-2,
 * `app/utils/qr-reader.ts`), which has been used at the booth: the browser's
 * own BarcodeDetector where it reads QR codes (Chrome on Android and macOS),
 * with jsQR as a second opinion on every frame it misses, and jsQR alone where
 * there is no detector (Safari on iPhone).
 */

/** Reads a QR code from the current frame of a playing video. */
export type QrReader = (video: HTMLVideoElement) => Promise<string | null>;

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface BarcodeDetectorClass {
  new (options: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

/** Longest side the fallback decodes at: enough for a phone screen held up close. */
const FALLBACK_EDGE = 800;

/** jsQR on a downscaled copy of the frame; loaded only when the scanner first opens. */
async function createJsQrReader(): Promise<QrReader> {
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!context || !video.videoWidth || !video.videoHeight) return null;
    const scale = Math.min(1, FALLBACK_EDGE / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    // A ticket is dark on light, but a phone in dark mode can show it inverted.
    return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
  };
}

export async function createQrReader(): Promise<QrReader> {
  const fallback = await createJsQrReader();
  const native = (globalThis as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
  if (!native) return fallback;
  try {
    if (!(await native.getSupportedFormats()).includes("qr_code")) return fallback;
    const detector = new native({ formats: ["qr_code"] });
    return async (video) => {
      const found = await detector.detect(video).catch(() => []);
      return found[0]?.rawValue ?? (await fallback(video));
    };
  } catch {
    return fallback;
  }
}

/** Why the camera could not start, in the cashier's words. */
export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Izin kamera ditolak. Izinkan kamera buat situs ini di pengaturan browser, atau ketik nomornya di kolom cari.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Kamera nggak ketemu di perangkat ini. Ketik nomornya di kolom cari ya.";
    case "NotReadableError":
      return "Kameranya lagi dipakai aplikasi lain. Tutup dulu aplikasinya, lalu coba lagi.";
    default:
      return "Kameranya nggak bisa dibuka. Ketik nomornya di kolom cari ya.";
  }
}
