"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { stripLabel } from "@/lib/staff-chrome";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Whether the browser thinks it is online. The server, and the very first paint
 * after hydration, assume it is — saying "putus" before anything has been
 * checked would be the one wrong thing to flash.
 */
function useOnline(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * The band under the staff header, in the role's colour: which world and which
 * screen ("Counter Station · Preorder"), and whether the screen is still
 * hearing from the server.
 *
 * The pill matters most on the kitchen and the till, which sit on event WiFi
 * and refresh themselves: when it drops, the board stops moving without looking
 * any different. "Koneksi putus" is the cue to look before trusting it.
 */
export function StaffStrip({ role }: { role: string }) {
  const pathname = usePathname();
  const online = useOnline();

  return (
    <div className="s-strip">
      <div className="s-wrap">
        <span className="truncate">{stripLabel(role, pathname)}</span>
        <span className={cn("s-live", !online && "s-live-off")} role="status">
          <i aria-hidden="true" />
          {online ? "Live" : "Koneksi putus"}
        </span>
      </div>
    </div>
  );
}
