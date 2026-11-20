"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { uploadAdminPhoto } from "@/lib/admin-photo-upload";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

export interface BundlePhotoProps {
  bundleId: string;
  bundleName: string;
  /** The cover the catalogue shows now; null draws the paket from its contents. */
  imageUrl: string | null;
}

/**
 * A paket's cover photo, inside its sheet: pick one from the phone or the
 * laptop, replace it, or take it off (two taps). The picture is shrunk in the
 * browser to at most 1200 px and sent as JPEG; the server checks its content.
 */
export function BundlePhoto({ bundleId, bundleName, imageUrl }: BundlePhotoProps) {
  const router = useRouter();
  const { toast } = useToast();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<"upload" | "remove" | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy("upload");
    setError(null);
    const result = await uploadAdminPhoto<{ url: string }>(`/api/admin/paket/${bundleId}/foto`, file, "paket.jpg");
    setBusy(null);
    if (input.current) input.current.value = "";
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast(imageUrl ? "Foto paketnya udah diganti" : "Foto paketnya udah dipasang");
    router.refresh();
  };

  const remove = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy("remove");
    setError(null);
    try {
      const response = await fetch(`/api/admin/paket/${bundleId}/foto`, { method: "DELETE" });
      const result = (await response.json()) as ActionResult<{ removed: true }>;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Foto paketnya udah dicopot");
      router.refresh();
    } catch {
      setError("Gagal menghapus. Coba lagi ya");
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };

  const inputId = `bundle-photo-${bundleId}`;

  return (
    <section aria-labelledby={`${inputId}-title`} className="flex flex-col gap-2.5">
      <h3 id={`${inputId}-title`} className="text-[13px] font-semibold text-ink">
        Foto paket
      </h3>

      {imageUrl ? (
        <div className="relative aspect-[4/3] w-full max-w-[280px] overflow-hidden rounded-[10px] border-[1.5px] border-line bg-cream">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`Foto paket ${bundleName}`}
            className={cn("h-full w-full object-cover", busy && "opacity-50")}
          />
        </div>
      ) : (
        <p className="text-[12.5px] text-ink-soft">Belum ada foto; katalog menggambar paketnya dari isinya.</p>
      )}

      <input
        ref={input}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        disabled={busy !== null}
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <label
          htmlFor={inputId}
          aria-disabled={busy !== null}
          className={cn(
            "flex min-h-[44px] items-center justify-center rounded-[12px] border-[1.5px] border-dashed border-line bg-white px-4 text-[14px] font-semibold text-ink",
            busy !== null ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-cream",
          )}
        >
          {busy === "upload" ? "Mengunggah…" : imageUrl ? "Ganti foto" : "Pasang foto"}
        </label>
        {imageUrl && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void remove()}
            className={cn(
              "min-h-[44px] rounded-[12px] border-[1.5px] px-4 text-[14px] font-semibold disabled:opacity-50",
              confirming ? "border-hot bg-hot text-white" : "border-line bg-white text-ink hover:bg-cream",
            )}
          >
            {busy === "remove" ? "Menghapus…" : confirming ? "Yakin? Ketuk lagi buat copot" : "Copot foto"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-hot">
          {error}
        </p>
      )}
    </section>
  );
}
