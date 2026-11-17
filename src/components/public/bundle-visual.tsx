import * as React from "react";
import { cn } from "@/lib/utils";
import { ProductVisual } from "./product-card";
import type { PublicBundle } from "@/lib/bundle";

/**
 * A paket's picture: its own image when the admin gave it one, otherwise its
 * products side by side, each on its own strip of scenery — which is how the
 * design draws a combo anyway, so a paket without a photo does not look
 * unfinished.
 */
export function BundleVisual({
  bundle,
  className,
  dimmed,
}: {
  bundle: Pick<PublicBundle, "imageUrl" | "items">;
  className?: string;
  dimmed?: boolean;
}) {
  if (bundle.imageUrl) {
    return (
      <span className={cn("block overflow-hidden", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bundle.imageUrl}
          alt=""
          loading="lazy"
          className={cn("h-full w-full object-cover", dimmed && "grayscale-[60%]")}
        />
      </span>
    );
  }

  const shown = bundle.items.slice(0, 3);

  return (
    <span
      aria-hidden="true"
      className={cn("grid gap-1", className)}
      style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
    >
      {shown.map((item) => (
        <ProductVisual
          key={item.productId}
          dimmed={dimmed}
          product={{
            name: item.name,
            imageUrl: item.imageUrl,
            categoryName: item.categoryName,
            prepType: item.prepType,
          }}
          className="h-full w-full"
        />
      ))}
    </span>
  );
}
