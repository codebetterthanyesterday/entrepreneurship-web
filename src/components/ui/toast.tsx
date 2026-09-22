"use client";

import * as React from "react";
import { useToast } from "./use-toast";
import { cn } from "@/lib/utils";

export function Toast() {
  const { message } = useToast();

  if (!message) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[min(92vw,420px)] px-4 pointer-events-none">
      <div 
        className={cn(
          // No `whitespace-nowrap`: the longest message in the app ("Yah, <menu>
          // keburu habis...") is well past 375px and used to run off both edges
          // of the screen instead of wrapping.
          "bg-ink text-white px-4 py-3 rounded-[14px] text-sm font-medium shadow-lg text-center",
          "animate-fade-in motion-reduce:animate-none"
        )}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </div>
  );
}
