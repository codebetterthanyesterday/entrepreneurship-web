import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A placeholder block for content that is still being fetched.
 *
 * `aria-hidden`, because a skeleton has nothing to say: the region it sits in
 * carries the `aria-busy` and the "Lagi ngambil data..." label, so a screen
 * reader hears one announcement instead of a dozen empty boxes. The pulse sits
 * out when the reader has asked for less motion.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-line/70 rounded-[14px] animate-pulse motion-reduce:animate-none",
        className,
      )}
    />
  );
}

export interface LoadingScreenProps {
  /** What is being fetched, for the line a screen reader announces. */
  label: string;
  children: React.ReactNode;
}

/**
 * The frame every `loading.tsx` uses.
 *
 * Next swaps this in while the server component fetches, so the shape on
 * screen should be the shape that is coming — a spinner in the middle of an
 * empty page reads as "nothing here" on a slow venue connection, which is
 * exactly the wrong thing to tell someone waiting at a booth.
 */
export function LoadingScreen({ label, children }: LoadingScreenProps) {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
