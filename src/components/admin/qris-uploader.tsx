"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { shrinkImage } from "@/lib/shrink-image";
import type { ActionResult } from "@/lib/action-result";

export interface QrisUploaderProps {
  qrisImageUrl: string | null;
}

/**
 * The booth's QRIS, uploaded straight from the admin's phone or laptop.
 *
 * It is what a customer who chooses QRIS scans on their order page, and what
 * the till shows at the booth. Without one, QRIS is not offered at checkout.
 */
export function QrisUploader({ qrisImageUrl }: QrisUploaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<"upload" | "remove" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);

  const upload = async (file: File) => {
    setBusy("upload");
    setError(null);
    try {
      // A photo of a printed QRIS stays JPEG (as PNG it would balloon); an
      // image exported from the merchant app stays PNG, keeping its edges.
      const jpeg = file.type === "image/jpeg";
      const shrunk = await shrinkImage(file, {
        maxEdge: 1600,
        type: jpeg ? "image/jpeg" : "image/png",
        quality: 0.92,
      });
      const form = new FormData();
      form.append("file", shrunk, jpeg ? "qris.jpg" : "qris.png");
      const response = await fetch("/api/admin/qris", { method: "POST", body: form });
      const result = (await response.json()) as ActionResult<{ url: string }>;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("QRIS-nya udah terpasang!");
      router.refresh();
    } catch {
      setError("Gagal mengunggah. Cek sinyal, lalu coba lagi ya");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy("remove");
    setError(null);
    try {
      const response = await fetch("/api/admin/qris", { method: "DELETE" });
      const result = (await response.json()) as ActionResult<{ removed: true }>;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("QRIS-nya udah dicopot");
      router.refresh();
    } catch {
      setError("Gagal menghapus. Coba lagi ya");
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="qris-title">
      <h2 id="qris-title" className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
        QRIS pembayaran
      </h2>

      <div className="flex flex-col gap-4 rounded-[16px] border-[1.5px] border-line bg-white p-3.5 tablet:flex-row tablet:items-start">
        <div className="flex h-[200px] w-[200px] flex-none items-center justify-center overflow-hidden rounded-[14px] border-[1.5px] border-line bg-cream">
          {qrisImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrisImageUrl} alt="QRIS yang sedang dipakai" className="h-full w-full object-contain" />
          ) : (
            <span className="px-4 text-center text-[13px] text-ink-soft">Belum ada QRIS</span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            {qrisImageUrl
              ? "QRIS ini muncul di halaman pesanan pelanggan yang memilih bayar QRIS, dan di layar kasir."
              : "Selama belum ada QRIS, pelanggan cuma bisa pilih bayar tunai pas ambil."}{" "}
            Pakai gambar QRIS asli dari aplikasi merchant (PNG atau JPG, maksimal 3 MB).
          </p>

          {error && (
            <p role="alert" className="rounded-[12px] border border-hot/20 bg-hot-soft p-3 text-sm font-medium text-hot">
              {error}
            </p>
          )}

          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            id="qris-file"
            disabled={busy !== null}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={busy === "upload"}
              disabled={busy !== null}
              onClick={() => input.current?.click()}
              className="px-5"
            >
              {qrisImageUrl ? "Ganti QRIS" : "Unggah QRIS"}
            </Button>
            {qrisImageUrl && (
              <Button
                type="button"
                variant="flat"
                size="sm"
                isLoading={busy === "remove"}
                disabled={busy !== null}
                onClick={remove}
                className="px-5"
              >
                {confirming ? "Yakin copot?" : "Copot QRIS"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
