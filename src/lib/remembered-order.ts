/**
 * The last order this device tracked, so /lacak can open straight onto it.
 *
 * A customer checks the same order several times between paying and picking it
 * up, and typing the number and four digits again each time is the friction this
 * removes. The checkout saves it the moment an order exists; a successful search
 * on /lacak saves it too; "Ganti pesanan" forgets it.
 *
 * Only what the customer already typed is kept — the number and the last four
 * digits of their WhatsApp — and only in this browser. It is the same pair the
 * tracking API asks for, so it grants nothing the customer did not already have.
 */

export interface RememberedOrder {
  orderNumber: string;
  phoneLast4: string;
}

export const REMEMBERED_ORDER_KEY = "lacak-terakhir";

/**
 * The last four digits of a phone number, or `null` when it has fewer than four.
 *
 * Shared by the tracking query, which compares them, and the checkout, which
 * remembers them — the two must agree on what "the last four" means.
 */
export function lastFourDigits(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/** Reads a stored value back, refusing anything malformed rather than trusting it. */
export function parseRememberedOrder(raw: string | null): RememberedOrder | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { orderNumber, phoneLast4 } = parsed as Record<string, unknown>;
    if (typeof orderNumber !== "string" || orderNumber.trim() === "") return null;
    if (typeof phoneLast4 !== "string" || !/^\d{4}$/.test(phoneLast4)) return null;

    return { orderNumber: orderNumber.trim(), phoneLast4 };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// localStorage as an external store, the same shape as the cart's: read through
// useSyncExternalStore so the server render and the first client render agree,
// and a change in one tab reaches the others.
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeRememberedOrder(onChange: () => void): () => void {
  listeners.add(onChange);

  const onStorage = (event: StorageEvent) => {
    if (event.key === REMEMBERED_ORDER_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The raw stored text — a string, so the snapshot is stable between reads. */
export function readRememberedOrderRaw(): string | null {
  try {
    return window.localStorage.getItem(REMEMBERED_ORDER_KEY);
  } catch {
    // Private mode, blocked storage: behave as if nothing was ever saved.
    return null;
  }
}

export function rememberOrder(order: RememberedOrder): void {
  try {
    window.localStorage.setItem(REMEMBERED_ORDER_KEY, JSON.stringify(order));
  } catch {
    return;
  }
  notify();
}

export function forgetRememberedOrder(): void {
  try {
    window.localStorage.removeItem(REMEMBERED_ORDER_KEY);
  } catch {
    return;
  }
  notify();
}
