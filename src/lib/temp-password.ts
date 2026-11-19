import { randomInt } from "node:crypto";

/**
 * A password an admin hands to a staff member once, when creating their
 * account or resetting it: three groups of four, like `k7f3-q9x2-m4wd`.
 *
 * Unlike the script's `<nama>123`, nobody else on the team can guess it, so
 * handing it over in person is the only way it travels. Lowercase letters and
 * digits without the look-alikes (0/o, 1/l/i), easy to type on a phone, and
 * about 60 bits: far past guessing within the sign-in rate limit. The account
 * is flagged `mustChangePassword` all the same.
 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function temporaryPassword(): string {
  const group = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}
