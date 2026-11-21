import type { InboxItem } from "@/lib/inbox";

/**
 * What one staff phone remembers about the inbox (inbox phase 2): when it
 * last opened the inbox, the "Pantau" items it put off for a while, whether
 * it chimes for new work, and which items it has already chimed for.
 *
 * Kept on the device, in localStorage: it is about this person's screen, not
 * the order, so the server and the other phones are none the wiser. Without
 * storage (private mode) the inbox still works, just without these.
 */
export interface InboxDeviceState {
  /** When the inbox was opened this visit, epoch ms. */
  openedAt: number | null;
  /** When it was opened the visit before: what "Baru" counts from. */
  previousOpenedAt: number | null;
  /** "Pantau" item key → epoch ms it comes back. */
  snoozed: Record<string, number>;
  /** Chime and buzz for new work. Off until the person turns it on. */
  alerts: boolean;
  /** Keys already chimed for, so a page change does not chime again. */
  announced: string[];
}

export const INBOX_DEVICE_KEY = "bunnye_inbox";
export const SNOOZE_MINUTES = 60;
/** Two opens closer than this are one visit (a reload, a double mount). */
const SAME_VISIT_MS = 10_000;

export const EMPTY_DEVICE_STATE: InboxDeviceState = {
  openedAt: null,
  previousOpenedAt: null,
  snoozed: {},
  alerts: false,
  announced: [],
};

/** Stored text to state, tolerating anything a hand or an old version left there. */
export function parseDeviceState(raw: string | null): InboxDeviceState {
  if (!raw) return EMPTY_DEVICE_STATE;
  try {
    const value = JSON.parse(raw) as Partial<InboxDeviceState>;
    const time = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : null);
    const snoozed: Record<string, number> = {};
    for (const [key, until] of Object.entries(value.snoozed ?? {})) {
      if (typeof until === "number" && Number.isFinite(until)) snoozed[key] = until;
    }
    return {
      openedAt: time(value.openedAt),
      previousOpenedAt: time(value.previousOpenedAt),
      snoozed,
      alerts: value.alerts === true,
      announced: Array.isArray(value.announced) ? value.announced.filter((k) => typeof k === "string") : [],
    };
  } catch {
    return EMPTY_DEVICE_STATE;
  }
}

/** The inbox was opened at `now`: the last open becomes what "Baru" counts from. */
export function markOpened(state: InboxDeviceState, now: number): InboxDeviceState {
  if (state.openedAt !== null && now - state.openedAt < SAME_VISIT_MS) return state;
  return { ...state, previousOpenedAt: state.openedAt, openedAt: now };
}

/**
 * Whether an item happened since the inbox was last opened here. "Pantau"
 * items are a state, not an event, so they are never "Baru"; on a phone that
 * has never opened the inbox, nothing is.
 */
export function isNew(item: InboxItem, state: InboxDeviceState): boolean {
  if (item.tone === "watch" || state.previousOpenedAt === null) return false;
  return new Date(item.since).getTime() > state.previousOpenedAt;
}

/** Put a "Pantau" item off for an hour. Anything more pressing cannot be put off. */
export function snooze(state: InboxDeviceState, item: InboxItem, now: number): InboxDeviceState {
  if (item.tone !== "watch") return state;
  return { ...state, snoozed: { ...state.snoozed, [item.key]: now + SNOOZE_MINUTES * 60_000 } };
}

export function unsnooze(state: InboxDeviceState, key: string): InboxDeviceState {
  if (!(key in state.snoozed)) return state;
  return { ...state, snoozed: Object.fromEntries(Object.entries(state.snoozed).filter(([k]) => k !== key)) };
}

export function isSnoozed(state: InboxDeviceState, key: string, now: number): boolean {
  return (state.snoozed[key] ?? 0) > now;
}

/** Snoozes that have run out, dropped so the store does not grow. */
export function pruneSnoozes(state: InboxDeviceState, now: number): InboxDeviceState {
  const live = Object.fromEntries(Object.entries(state.snoozed).filter(([, until]) => until > now));
  return Object.keys(live).length === Object.keys(state.snoozed).length ? state : { ...state, snoozed: live };
}

/**
 * Which of `items` to chime for: work that needs a person and has not been
 * chimed for yet. Returns them and the state that remembers them, keeping
 * only what is still in the inbox so the list stays small.
 */
export function toAnnounce(
  state: InboxDeviceState,
  items: readonly InboxItem[],
): { fresh: InboxItem[]; next: InboxDeviceState } {
  const work = items.filter((item) => item.tone !== "watch");
  const known = new Set(state.announced);
  const fresh = work.filter((item) => !known.has(item.key));
  const announced = work.map((item) => item.key);
  const same = announced.length === state.announced.length && announced.every((key) => known.has(key));
  return { fresh, next: same ? state : { ...state, announced } };
}

// ---------------------------------------------------------------------------
// The store: localStorage behind useSyncExternalStore, as `remembered-order`.
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();

export function subscribeInboxDevice(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === INBOX_DEVICE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The raw stored text: a string, so the snapshot is stable between reads. */
export function readInboxDeviceRaw(): string | null {
  try {
    return window.localStorage.getItem(INBOX_DEVICE_KEY);
  } catch {
    return null;
  }
}

/** Applies `change` to what is stored now and saves it, unless nothing changed. */
export function updateInboxDevice(change: (state: InboxDeviceState) => InboxDeviceState): void {
  const before = parseDeviceState(readInboxDeviceRaw());
  const after = change(before);
  if (after === before) return;
  try {
    window.localStorage.setItem(INBOX_DEVICE_KEY, JSON.stringify(after));
  } catch {
    return;
  }
  for (const listener of listeners) listener();
}
