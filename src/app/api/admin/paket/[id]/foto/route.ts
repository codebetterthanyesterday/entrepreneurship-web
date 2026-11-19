import { toActionError, type ActionResult } from "@/lib/action-result";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { requireRole } from "@/lib/session";
import { revalidateProductPhotos } from "@/lib/revalidate-product";
import { clearBundleImage, setBundleImage } from "@/lib/services/bundle-image.service";
import { MAX_IMAGE_BYTES } from "@/lib/stored-image";

/**
 * A paket's cover photo: `POST` (multipart `file`) puts one in, replacing the
 * last; `DELETE` takes it off. As with menu photos, the browser shrinks the
 * picture first and the server checks its content. The proxy skips `/api/*`,
 * so `requireRole` here is the guard.
 */
function statusOf(error: unknown): number {
  if (error instanceof UnauthorizedError) return 401;
  if (error instanceof ForbiddenError) return 403;
  return 400;
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  let result: ActionResult<{ url: string }>;
  try {
    await requireRole("ADMIN");
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_IMAGE_BYTES + 64 * 1024) {
      return Response.json(
        { ok: false, error: "Fotonya kegedean. Maksimal 3 MB ya", field: "file" },
        { status: 413 },
      );
    }
    const { id } = await ctx.params;
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) {
      result = { ok: false, error: "Pilih fotonya dulu ya", field: "file" };
    } else {
      result = { ok: true, data: await setBundleImage(id, new Uint8Array(await file.arrayBuffer())) };
      revalidateProductPhotos();
    }
  } catch (error) {
    return Response.json(toActionError(error, "POST /api/admin/paket/[id]/foto"), { status: statusOf(error) });
  }
  return Response.json(result, { status: result.ok ? 200 : 400 });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireRole("ADMIN");
    const { id } = await ctx.params;
    await clearBundleImage(id);
    revalidateProductPhotos();
    return Response.json({ ok: true, data: { removed: true } });
  } catch (error) {
    return Response.json(toActionError(error, "DELETE /api/admin/paket/[id]/foto"), { status: statusOf(error) });
  }
}
