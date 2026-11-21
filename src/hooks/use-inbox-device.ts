"use client";

import * as React from "react";
import {
  parseDeviceState,
  readInboxDeviceRaw,
  subscribeInboxDevice,
  type InboxDeviceState,
} from "@/lib/inbox-device";

/**
 * This phone's inbox memory (`@/lib/inbox-device`), live: a change in another
 * tab, or by the bell, redraws whoever reads it. The server, which has no
 * storage, renders the empty state, and so does the first client render.
 */
export function useInboxDevice(): InboxDeviceState {
  const raw = React.useSyncExternalStore(subscribeInboxDevice, readInboxDeviceRaw, () => null);
  return React.useMemo(() => parseDeviceState(raw), [raw]);
}
