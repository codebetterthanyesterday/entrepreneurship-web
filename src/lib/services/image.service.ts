import { prisma as db } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { findForTracking } from "@/lib/queries/order.query";
import { MAX_IMAGE_BYTES, imageIdOf, imagePath, sniffImage, type ImageMime } from "@/lib/stored-image";

/**
 * Images kept in the database (`StoredImage`): the booth's QRIS, uploaded by an
 * admin, and a customer's proof of a QRIS payment.
 *
 * Every file is checked from its content (`sniffImage`), never from the name
 * or the type the browser claims, and capped at `MAX_IMAGE_BYTES` (the table
 * enforces the same cap). Replacing an image deletes the old one in the same
 * transaction, so each setting and each order holds at most one.
 */

/** The type of an uploaded image, or a `ValidationError` the uploader can read. */
export function checkedImage(bytes: Uint8Array): ImageMime {
  if (bytes.length === 0) throw new ValidationError("Gambarnya kosong. Coba pilih lagi ya", "file");
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new ValidationError("Gambarnya kegedean. Maksimal 3 MB ya", "file");
  }
  const mime = sniffImage(bytes);
  if (!mime) throw new ValidationError("Itu bukan gambar PNG, JPG, atau WebP", "file");
  return mime;
}

/** The admin's QRIS: stored, put into the settings, the previous one removed. */
export async function setQrisImage(bytes: Uint8Array): Promise<{ url: string }> {
  const mimeType = checkedImage(bytes);

  return await db.transaction(async (tx) => {
    const settings = await tx.orm.public.StoreSetting.where({ id: 1 }).first();
    const image = await tx.orm.public.StoredImage.create({
      kind: "QRIS",
      mimeType,
      data: bytes,
      byteSize: bytes.length,
    });
    const url = imagePath(image.id);

    if (settings) {
      await tx.orm.public.StoreSetting.where({ id: 1 }).update({ qrisImageUrl: url });
    } else {
      await tx.orm.public.StoreSetting.create({ id: 1, qrisImageUrl: url });
    }

    const previous = imageIdOf(settings?.qrisImageUrl);
    if (previous) await tx.orm.public.StoredImage.where({ id: previous }).delete();

    return { url };
  });
}

/** Takes the QRIS down: customers can no longer choose it until a new one is uploaded. */
export async function clearQrisImage(): Promise<void> {
  await db.transaction(async (tx) => {
    const settings = await tx.orm.public.StoreSetting.where({ id: 1 }).first();
    if (!settings?.qrisImageUrl) return;

    await tx.orm.public.StoreSetting.where({ id: 1 }).update({ qrisImageUrl: null });
    const previous = imageIdOf(settings.qrisImageUrl);
    if (previous) await tx.orm.public.StoredImage.where({ id: previous }).delete();
  });
}

/**
 * A customer's proof that they paid by QRIS.
 *
 * Gated like tracking: the order number and the last four digits of the
 * WhatsApp number, and every miss is the same "not found", so the endpoint
 * cannot be used to learn which order numbers exist. Only an unpaid QRIS
 * preorder that is still live takes a proof; a second upload replaces the
 * first. It does not mark anything paid — the cashier does that after seeing
 * the payment arrive, with the proof beside it.
 */
export async function attachPaymentProof(input: {
  orderNumber: string;
  phoneLast4: string;
  bytes: Uint8Array;
}): Promise<{ url: string }> {
  const order = await findForTracking(input.orderNumber, input.phoneLast4);
  if (!order) throw new NotFoundError("Pesanannya nggak ketemu. Cek lagi nomor dan 4 digit WhatsApp kamu");

  if (order.paymentMethod !== "QRIS") {
    throw new ValidationError("Pesanan ini bayarnya tunai, jadi nggak perlu bukti bayar");
  }
  if (order.paymentStatus === "PAID") {
    throw new ValidationError("Pesanan ini udah lunas, nggak perlu unggah bukti lagi");
  }
  if (order.status === "CANCELLED") {
    throw new ValidationError("Pesanan ini udah dibatalkan");
  }

  const mimeType = checkedImage(input.bytes);

  return await db.transaction(async (tx) => {
    const image = await tx.orm.public.StoredImage.create({
      kind: "PAYMENT_PROOF",
      mimeType,
      data: input.bytes,
      byteSize: input.bytes.length,
    });
    const url = imagePath(image.id);

    // Conditional on still being unpaid, so a proof that arrives just as the
    // cashier marks the order paid does not overwrite anything after the fact.
    const plan = tx.sql.public.order
      .update({ paymentProofUrl: url })
      .where((field, fns) => fns.eq(field.id, order.id))
      .where((field, fns) => fns.eq(field.paymentStatus, "UNPAID"))
      .build();
    const { affectedRows } = await tx.execute(plan);
    if (affectedRows === 0) {
      throw new ValidationError("Pesanan ini udah lunas, nggak perlu unggah bukti lagi");
    }

    const previous = imageIdOf(order.paymentProofUrl);
    if (previous) await tx.orm.public.StoredImage.where({ id: previous }).delete();

    return { url };
  });
}
