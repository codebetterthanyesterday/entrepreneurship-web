"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { moveProductImageAction, removeProductImageAction } from "@/actions/product.actions";
import { shrinkImage } from "@/lib/shrink-image";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/** Mirrors `MAX_PRODUCT_IMAGES` on the server, which has the last word. */
const MAX_PHOTOS = 6;
/** Wide enough for the product sheet on a desktop, small enough for the booth's signal. */
const MAX_EDGE = 1200;

export interface ProductPhotosProps {
  productId: string;
  productName: string;
  images: { id: string; url: string }[];
}

/**
 * The admin's photos of one menu item, inside the product sheet: add several
 * at once, take one away, move one earlier or later. The first is the cover
 * the catalogue, the cart and the till show; the rest appear in the product's
 * own sheet. A product with none keeps its drawing.
 *
 * Each picture is shrunk in the browser to at most 1200 px and sent as JPEG,
 * one at a time, so a slow connection shows its progress and a refusal (too
 * many, not a picture) stops the batch with the reason.
 */
export function ProductPhotos({ productId, productName, images }: ProductPhotosProps) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<string | null>(null);

  const room = MAX_PHOTOS - images.length;

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) {
      toast(`Cuma muat ${room} foto lagi; ${files.length - room} sisanya nggak diunggah`);
    }
    setBusy("upload");
    let added = 0;
    for (const [index, file] of chosen.entries()) {
      setProgress(`Mengunggah ${index + 1} dari ${chosen.length}…`);
      try {
        const shrunk = await shrinkImage(file, { maxEdge: MAX_EDGE, type: "image/jpeg", quality: 0.82 });
        const form = new FormData();
        form.append("file", shrunk, "foto.jpg");
        const response = await fetch(`/api/admin/produk/${productId}/foto`, { method: "POST", body: form });
        const result = (await response.json()) as ActionResult<{ id: string; url: string }>;
        if (!result.ok) {
          toast(result.error);
          break;
        }
        added += 1;
      } catch {
        toast("Fotonya gagal terkirim. Cek sinyal, lalu coba lagi");
        break;
      }
    }
    if (inputRef.current) inputRef.current.value = "";
    setBusy(null);
    setProgress(null);
    if (added > 0) toast(added === 1 ? "Fotonya udah ditambah" : `${added} foto udah ditambah`);
    router.refresh();
  };

  const run = async (imageId: string, action: () => Promise<ActionResult<unknown>>, done?: string) => {
    setBusy(imageId);
    const result = await action();
    setBusy(null);
    setConfirming(null);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    if (done) toast(done);
    router.refresh();
  };

  return (
    <section aria-labelledby="product-photos-title" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="product-photos-title" className="text-[13px] font-semibold text-ink">
          Foto menu
        </h3>
        <span className="text-[12px] text-ink-soft">
          {images.length} dari {MAX_PHOTOS}
        </span>
      </div>

      {images.length === 0 ? (
        <p className="text-[12.5px] text-ink-soft">
          Belum ada foto; katalog memakai gambar bawaan. Foto pertama jadi sampul.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 tablet:grid-cols-3" aria-label={`Foto ${productName}`}>
          {images.map((image, index) => {
            const label = `foto ${index + 1}`;
            const working = busy === image.id;
            return (
              <li key={image.id} className="flex flex-col gap-1">
                <div className="relative aspect-square overflow-hidden rounded-[10px] border-[1.5px] border-line bg-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={`${productName}, ${label}`}
                    className={cn("h-full w-full object-cover", working && "opacity-50")}
                  />
                  {index === 0 && (
                    <span className="absolute left-1 top-1 rounded-full bg-ink-deep px-2 py-0.5 text-[10.5px] font-bold text-white">
                      Sampul
                    </span>
                  )}
                </div>
                {confirming === image.id ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        run(image.id, () => removeProductImageAction({ productId, imageId: image.id }), "Fotonya udah dihapus")
                      }
                      className="min-h-[44px] flex-1 rounded-[8px] bg-hot text-[12px] font-bold text-white disabled:opacity-50"
                    >
                      Hapus
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="min-h-[44px] flex-1 rounded-[8px] border-[1.5px] border-line bg-white text-[12px] font-bold text-ink"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <IconButton
                      label={`Geser ${label} ke depan`}
                      disabled={busy !== null || index === 0}
                      onClick={() => run(image.id, () => moveProductImageAction({ productId, imageId: image.id, by: -1 }))}
                    >
                      <path d="M15 6l-6 6 6 6" />
                    </IconButton>
                    <IconButton
                      label={`Geser ${label} ke belakang`}
                      disabled={busy !== null || index === images.length - 1}
                      onClick={() => run(image.id, () => moveProductImageAction({ productId, imageId: image.id, by: 1 }))}
                    >
                      <path d="M9 6l6 6-6 6" />
                    </IconButton>
                    <IconButton label={`Hapus ${label}`} disabled={busy !== null} onClick={() => setConfirming(image.id)}>
                      <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
                    </IconButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="sr-only"
        id={`product-photo-input-${productId}`}
        disabled={busy !== null || room <= 0}
        onChange={(event) => void upload(event.target.files)}
      />
      <label
        htmlFor={`product-photo-input-${productId}`}
        aria-disabled={busy !== null || room <= 0}
        className={cn(
          "flex min-h-[48px] items-center justify-center rounded-[12px] border-[1.5px] border-dashed border-line bg-white px-4 text-[14px] font-semibold text-ink",
          busy !== null || room <= 0 ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-cream",
        )}
      >
        {progress ?? (room <= 0 ? `Udah ${MAX_PHOTOS} foto, hapus satu dulu buat nambah` : "Tambah foto")}
      </label>
      <p role="status" className="sr-only">
        {progress ?? ""}
      </p>
    </section>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-[44px] flex-1 items-center justify-center rounded-[8px] border-[1.5px] border-line bg-white text-ink transition-colors hover:bg-cream disabled:opacity-35"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[2.2]" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
