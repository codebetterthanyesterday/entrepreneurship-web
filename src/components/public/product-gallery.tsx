"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProductGalleryProps {
  name: string;
  images: string[];
  className?: string;
}

/**
 * A menu item's photos in its sheet, when it has more than one: swiped on a
 * phone (scroll snapping, so each stops whole), or stepped with the arrows,
 * with "2/4" saying where you are. The first photo is the cover the catalogue
 * shows; a product with one photo or none keeps the plain picture.
 */
export function ProductGallery({ name, images, className }: ProductGalleryProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [current, setCurrent] = React.useState(0);

  const onScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setCurrent(Math.round(track.scrollLeft / track.clientWidth));
  };

  const go = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const target = Math.max(0, Math.min(images.length - 1, index));
    track.scrollTo({ left: target * track.clientWidth, behavior: "smooth" });
    setCurrent(target);
  };

  return (
    <div className={cn("relative", className)} role="group" aria-roledescription="galeri" aria-label={`Foto ${name}`}>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] motion-reduce:scroll-auto"
      >
        {images.map((src, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={`${name}, foto ${index + 1} dari ${images.length}`}
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full flex-none snap-center object-cover"
          />
        ))}
      </div>

      <span
        aria-live="polite"
        className="absolute bottom-2.5 right-2.5 rounded-full bg-ink-deep/80 px-2.5 py-1 text-[12px] font-bold tabular-nums text-white"
      >
        {current + 1}/{images.length}
      </span>
      <GalleryArrow side="left" label="Foto sebelumnya" disabled={current === 0} onClick={() => go(current - 1)} />
      <GalleryArrow
        side="right"
        label="Foto berikutnya"
        disabled={current === images.length - 1}
        onClick={() => go(current + 1)}
      />
    </div>
  );
}

function GalleryArrow({
  side,
  label,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow transition-opacity disabled:pointer-events-none disabled:opacity-0",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[2.4]" strokeLinecap="round" strokeLinejoin="round">
        <path d={side === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}
