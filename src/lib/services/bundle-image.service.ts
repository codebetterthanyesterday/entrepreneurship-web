import { prisma as db } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { imageIdOf, imagePath } from "@/lib/stored-image";
import { checkedImage } from "@/lib/services/image.service";

/**
 * A paket's cover photo: one, uploaded by the admin, kept as a `StoredImage`
 * of kind BUNDLE and served publicly from `/gambar/<id>`. Its address goes in
 * `Bundle.imageUrl`, which the catalogue, the cart and the till already read.
 * Without one, the catalogue draws the paket from its contents.
 *
 * Replacing or removing the photo deletes the old one in the same
 * transaction. An address pasted in before uploads existed is not ours, so
 * it is only cleared, never looked up.
 */
export async function setBundleImage(bundleId: string, bytes: Uint8Array): Promise<{ url: string }> {
  const mimeType = checkedImage(bytes);

  return await db.transaction(async (tx) => {
    const bundle = await tx.orm.public.Bundle.where({ id: bundleId }).first();
    if (!bundle) throw new NotFoundError("Paketnya nggak ketemu");

    const image = await tx.orm.public.StoredImage.create({
      kind: "BUNDLE",
      mimeType,
      data: bytes,
      byteSize: bytes.length,
    });
    const url = imagePath(image.id);
    await tx.orm.public.Bundle.where({ id: bundleId }).update({ imageUrl: url });

    const previous = imageIdOf(bundle.imageUrl);
    if (previous) await tx.orm.public.StoredImage.where({ id: previous }).delete();

    return { url };
  });
}

/** Takes the cover photo off: the catalogue goes back to drawing the paket. */
export async function clearBundleImage(bundleId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const bundle = await tx.orm.public.Bundle.where({ id: bundleId }).first();
    if (!bundle) throw new NotFoundError("Paketnya nggak ketemu");
    if (!bundle.imageUrl) return;

    await tx.orm.public.Bundle.where({ id: bundleId }).update({ imageUrl: null });
    const previous = imageIdOf(bundle.imageUrl);
    if (previous) await tx.orm.public.StoredImage.where({ id: previous }).delete();
  });
}
