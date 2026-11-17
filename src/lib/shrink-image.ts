/**
 * Shrinks a picture in the browser before it is uploaded.
 *
 * A phone's screenshot or photo is often several megabytes and far larger than
 * anyone needs to read a QR code or a payment receipt, and the upload travels
 * over the booth's weak signal. The longest edge is brought down to `maxEdge`;
 * a picture already small enough is sent untouched.
 *
 * A QR code keeps its hard edges only as PNG, so the QRIS stays PNG; a proof is
 * a photo or a screenshot and goes as JPEG. Anything the browser cannot decode
 * is passed through as it is, and the server decides.
 */
export async function shrinkImage(
  file: File,
  { maxEdge, type, quality = 0.85 }: { maxEdge: number; type: "image/png" | "image/jpeg"; quality?: number },
): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 900 * 1024) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  if (type === "image/jpeg") {
    // JPEG has no transparency: a see-through screenshot would turn black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((blob) => resolve(blob ?? file), type, quality),
  );
}
