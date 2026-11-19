import { toActionError, type ActionResult } from "@/lib/action-result";
import { normaliseOrderNumber } from "@/lib/order-number";
import { attachPaymentProof } from "@/lib/services/image.service";
import { MAX_IMAGE_BYTES } from "@/lib/stored-image";
import { clientIp } from "@/lib/client-ip";
import { LIMITS, hitRateLimit, waitLabel } from "@/lib/services/rate-limit.service";

/**
 * A customer sends the proof of their QRIS payment (`POST`, multipart:
 * `no`, `wa`, `file`).
 *
 * The same pair that opens tracking, the order number and the last four digits
 * of the WhatsApp number, and the same single answer for every kind of miss,
 * so it cannot be used to find out which orders exist. The proof only sits
 * beside the order for the cashier; it marks nothing paid.
 *
 * Every attempt counts against a limit per address and per order number
 * (`LIMITS`): each proof is stored in the database, and the number and digits
 * would otherwise be a second way to guess the four digits.
 */
export async function POST(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };

  // Refuse an oversized body before reading it into memory.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_IMAGE_BYTES + 64 * 1024) {
    return Response.json(
      { ok: false, error: "Gambarnya kegedean. Maksimal 3 MB ya", field: "file" } satisfies ActionResult<never>,
      { status: 413, headers },
    );
  }

  const tooMany = (seconds: number) =>
    Response.json(
      {
        ok: false,
        error: `Kebanyakan unggahan barusan. Coba lagi ${waitLabel(seconds)} lagi ya.`,
      } satisfies ActionResult<never>,
      { status: 429, headers: { ...headers, "Retry-After": String(seconds) } },
    );

  const byIp = await hitRateLimit(LIMITS.proofPerIp, clientIp(request.headers));
  if (!byIp.allowed) return tooMany(byIp.retryAfterSeconds);

  let result: ActionResult<{ url: string }>;
  try {
    const form = await request.formData();
    const byOrder = await hitRateLimit(
      LIMITS.proofPerOrder,
      normaliseOrderNumber(String(form.get("no") ?? "")),
    );
    if (!byOrder.allowed) return tooMany(byOrder.retryAfterSeconds);
    const file = form.get("file");
    if (!(file instanceof File)) {
      result = { ok: false, error: "Pilih gambar bukti bayarnya dulu ya", field: "file" };
    } else {
      const data = await attachPaymentProof({
        orderNumber: normaliseOrderNumber(String(form.get("no") ?? "")),
        phoneLast4: String(form.get("wa") ?? "").trim(),
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      result = { ok: true, data };
    }
  } catch (error) {
    result = toActionError(error, "POST /api/bukti-bayar");
  }

  return Response.json(result, { status: result.ok ? 200 : 400, headers });
}
