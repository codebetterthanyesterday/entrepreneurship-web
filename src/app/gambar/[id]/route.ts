import { findStoredImage } from "@/lib/queries/image.query";
import { getCurrentUser } from "@/lib/session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * An image kept in the database (`StoredImage`).
 *
 * The booth's QRIS is public: every customer paying by QRIS has to see it, and
 * a new upload is a new id, so the address is cached for good. A payment
 * proof is not: it shows a customer's transaction, so only staff at the till
 * (and admins) get it, never cached by anything shared. Every miss is the same
 * 404, so the route says nothing about which ids exist.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const notFound = () => new Response("Tidak ditemukan", { status: 404 });

  if (!UUID.test(id)) return notFound();
  const image = await findStoredImage(id);
  if (!image) return notFound();

  if (image.kind === "PAYMENT_PROOF") {
    const user = await getCurrentUser();
    if (!user || !["KASIR", "ADMIN"].includes(user.role)) return notFound();
  }

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.byteSize),
      // The bytes were checked on the way in; this keeps a browser from
      // second-guessing the type into something it would run.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control":
        image.kind === "QRIS" ? "public, max-age=31536000, immutable" : "private, no-store",
    },
  });
}
