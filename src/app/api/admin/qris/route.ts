import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/lib/action-result";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { requireRole } from "@/lib/session";
import { clearQrisImage, setQrisImage } from "@/lib/services/image.service";
import { MAX_IMAGE_BYTES } from "@/lib/stored-image";

/**
 * The booth's QRIS, uploaded by an admin (`POST`, multipart `file`) or taken
 * down (`DELETE`). The proxy skips `/api/*`, so `requireRole` here is the guard.
 */
/** 401 and 403 for a refused caller, 400 for anything they can fix. */
function statusOf(error: unknown): number {
  if (error instanceof UnauthorizedError) return 401;
  if (error instanceof ForbiddenError) return 403;
  return 400;
}

function revalidateQris() {
  revalidatePath("/admin/pengaturan");
  revalidatePath("/checkout");
  revalidatePath("/kasir");
  revalidatePath("/kasir/preorder");
}

export async function POST(request: Request): Promise<Response> {
  let result: ActionResult<{ url: string }>;
  try {
    await requireRole("ADMIN");

    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_IMAGE_BYTES + 64 * 1024) {
      return Response.json(
        { ok: false, error: "Gambarnya kegedean. Maksimal 3 MB ya", field: "file" },
        { status: 413 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      result = { ok: false, error: "Pilih gambar QRIS-nya dulu ya", field: "file" };
    } else {
      result = { ok: true, data: await setQrisImage(new Uint8Array(await file.arrayBuffer())) };
      revalidateQris();
    }
  } catch (error) {
    return Response.json(toActionError(error, "POST /api/admin/qris"), { status: statusOf(error) });
  }
  return Response.json(result, { status: result.ok ? 200 : 400 });
}

export async function DELETE(): Promise<Response> {
  let result: ActionResult<{ removed: true }>;
  try {
    await requireRole("ADMIN");
    await clearQrisImage();
    revalidateQris();
    result = { ok: true, data: { removed: true } };
  } catch (error) {
    return Response.json(toActionError(error, "DELETE /api/admin/qris"), { status: statusOf(error) });
  }
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
