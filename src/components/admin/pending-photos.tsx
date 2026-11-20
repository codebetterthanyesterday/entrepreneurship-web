"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PendingPhotosProps {
  /** The heading, e.g. "Foto paket". */
  title: string;
  /** Photos chosen so far, in order: the first becomes the cover. */
  files: readonly File[];
  onChange: (files: File[]) => void;
  /** How many may be chosen: 1 for a paket, 6 for a menu item. */
  max: number;
  disabled?: boolean;
  /** Said under the heading while nothing is chosen. */
  emptyNote: string;
}

/**
 * Photos picked for a menu item or a paket that is not saved yet. Nothing is
 * uploaded here: the sheet sends them once the save has given the item an id,
 * so a new item gets its pictures in one go instead of a second visit.
 */
export function PendingPhotos({ title, files, onChange, max, disabled, emptyNote }: PendingPhotosProps) {
  const id = React.useId();
  const input = React.useRef<HTMLInputElement>(null);
  const previews = useObjectUrls(files);
  const room = max - files.length;

  const add = (chosen: FileList | null) => {
    if (!chosen) return;
    onChange([...files, ...Array.from(chosen).slice(0, room)]);
    if (input.current) input.current.value = "";
  };

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={`${id}-title`} className="text-[13px] font-semibold text-ink">
          {title}
        </h3>
        {max > 1 && (
          <span className="text-[12px] text-ink-soft tabular-nums">
            {files.length} dari {max}
          </span>
        )}
      </div>

      {files.length === 0 ? (
        <p className="text-[12.5px] text-ink-soft">{emptyNote}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2" aria-label={`${title} yang dipilih`}>
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="relative">
              <div className="aspect-square overflow-hidden rounded-[10px] border-[1.5px] border-line bg-cream">
                {previews[index] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previews[index]}
                    alt={`${title} ${index + 1} yang dipilih`}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              {index === 0 && max > 1 && (
                <span className="absolute left-1 top-1 rounded-[6px] bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Sampul
                </span>
              )}
              <button
                type="button"
                disabled={disabled}
                aria-label={`Batal pakai ${title.toLowerCase()} ${index + 1}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[15px] font-bold text-ink shadow disabled:opacity-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {room > 0 && (
        <>
          <input
            ref={input}
            id={id}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple={max > 1}
            className="sr-only"
            disabled={disabled}
            onChange={(event) => add(event.target.files)}
          />
          <label
            htmlFor={id}
            aria-disabled={disabled}
            className={cn(
              "flex min-h-[44px] items-center justify-center rounded-[12px] border-[1.5px] border-dashed border-line bg-white px-4 text-[14px] font-semibold text-ink",
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-cream",
            )}
          >
            {files.length === 0 ? "Pilih foto" : "Tambah foto"}
          </label>
        </>
      )}
      <p className="text-[12px] text-ink-soft">Fotonya diunggah begitu disimpan.</p>
    </section>
  );
}

/** A preview address per file, revoked when the file goes or the sheet closes. */
function useObjectUrls(files: readonly File[]): string[] {
  const urls = React.useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  React.useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
  return urls;
}
