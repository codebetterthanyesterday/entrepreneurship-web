import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * A wa.me link from a number typed the way Indonesians type it.
 *
 * "081234567890" has to become "6281234567890" — wa.me takes a country code and
 * no leading zero, and the number in store settings is entered locally. Returns
 * null for anything that is not a usable number, so the caller can leave the
 * link out rather than render a dead one.
 */
export function toWhatsappUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length < 8) return null;

  const international = digits.startsWith("0")
    ? `62${digits.slice(1)}`
    : digits.startsWith("62")
      ? digits
      : digits;

  return `https://wa.me/${international}`;
}
