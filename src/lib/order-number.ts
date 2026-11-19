/**
 * Order numbers: what they look like, how a new one is drawn, and how one is
 * read back from whatever a person typed or a camera scanned.
 *
 * A number is `PO-` (preorder) or `OS-` (sale at the booth) and six random
 * characters: `PO-7KX4QM`. The numbering used to be a sequence (`PO-0001`,
 * `PO-0002`, …), which told anyone with one order number where every other
 * order was, and the order page opens with the number alone. Six characters
 * from 28 make about 481 million numbers for a few hundred orders, so a
 * guessed one is almost never real.
 *
 * The alphabet leaves out what is misread aloud or on a small screen (0/O,
 * 1/I/L) and every vowel, so no number spells a word. The sequential numbers
 * already handed out stay valid: those orders, their links and their photos
 * still exist.
 *
 * Pure, with no server imports: the cashier's QR scanner reads numbers in the
 * browser with the same rules.
 */

export const ORDER_CODE_ALPHABET = "23456789BCDFGHJKMNPQRSTVWXYZ";
export const ORDER_CODE_LENGTH = 6;

export type OrderNumberPrefix = "PO" | "OS";

const CODE = `[${ORDER_CODE_ALPHABET}]{${ORDER_CODE_LENGTH}}`;
/** Either form of number after its prefix: random now, sequential before. */
const BODY = `(?:${CODE}|\\d{4,})`;

/** Any order number, either channel, either form. */
export const ORDER_NUMBER_PATTERN = new RegExp(`^(?:PO|OS)-${BODY}$`);

/** A preorder's number, either form: what the photobooth's contract accepts. */
export const PREORDER_NUMBER_PATTERN = new RegExp(`^PO-${BODY}$`);

/**
 * Six characters from the alphabet, uniformly. A byte is used only when it is
 * below the largest multiple of the alphabet's size (252 for 28), so no
 * character comes up more often than another.
 */
export function randomOrderCode(random: (bytes: Uint8Array) => Uint8Array = fillRandom): string {
  const size = ORDER_CODE_ALPHABET.length;
  const limit = 256 - (256 % size);
  let code = "";
  while (code.length < ORDER_CODE_LENGTH) {
    for (const byte of random(new Uint8Array(16))) {
      if (byte < limit && code.length < ORDER_CODE_LENGTH) code += ORDER_CODE_ALPHABET[byte % size];
    }
  }
  return code;
}

function fillRandom(bytes: Uint8Array): Uint8Array {
  return globalThis.crypto.getRandomValues(bytes);
}

/** A new number for a channel, e.g. "PO-7KX4QM". Unchecked for uniqueness. */
export function newOrderNumber(prefix: OrderNumberPrefix): string {
  return `${prefix}-${randomOrderCode()}`;
}

/**
 * A number as someone typed it — any case, spaces, the dash left out
 * ("po 7kx4qm", "PO7KX4QM") — in its stored form ("PO-7KX4QM"). Anything that
 * does not then look like an order number comes back trimmed and uppercased
 * but otherwise untouched, so a lookup simply misses.
 */
export function normaliseOrderNumber(input: string): string {
  const compact = input.replace(/\s+/g, "").toUpperCase();
  const match = compact.match(/^(PO|OS)-?([0-9A-Z]+)$/);
  return match ? `${match[1]}-${match[2]}` : compact;
}

/** Whether a string is an order number in its stored form. */
export function isOrderNumber(value: string): boolean {
  return ORDER_NUMBER_PATTERN.test(value);
}

const IN_TEXT = new RegExp(`(?:PO|OS)-${BODY}(?![0-9A-Z])`, "i");

/**
 * The order number a scanned QR holds, or `null`.
 *
 * The ticket's QR is the bare number. The photobooth's QR is a link that
 * carries it (`…/foto?kode=PO-7KX4QM&t=…`), and a customer may well show that
 * one instead, so both are read. A QRIS code or any other link has none.
 */
export function orderNumberIn(text: string): string | null {
  const trimmed = text.trim();
  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get("kode") ?? url.searchParams.get("no");
    const candidate = fromQuery ?? decodeURIComponent(url.pathname);
    const found = candidate.match(IN_TEXT)?.[0];
    return found ? normaliseOrderNumber(found) : null;
  } catch {
    // Not a link: the number itself, or text around it.
  }
  const found = trimmed.match(IN_TEXT)?.[0];
  return found ? normaliseOrderNumber(found) : null;
}
