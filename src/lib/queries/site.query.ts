import { prisma as db } from "@/lib/prisma";
import { BRAND_NAME } from "@/lib/brand";

/** What every customer page shows about the business. */
export interface SiteIdentity {
  brandName: string;
  /** The one line under the name in the header. */
  tagline: string;
  /** Without the leading "@"; empty when there is none. */
  instagram: string;
}

/** What the header says when the admin has written nothing. */
export const DEFAULT_TAGLINE = "Pesan sekarang, ambil di Market Day atau diantar.";

/** The `SiteText` keys that named the business before Admin → Pengaturan did. */
const LEGACY_KEYS = { brandName: "hero.title", tagline: "footer.tagline", instagram: "contact.instagram" } as const;

/**
 * The business name, its one-line tagline and its Instagram handle, for the
 * header, the footer and the splash screen.
 *
 * Written by the admin in Admin → Pengaturan → Identitas toko (`StoreSetting`).
 * A field left empty there falls back to what the retired company-profile
 * editor saved in `SiteText`, if anything, and then to the default.
 */
export async function getSiteIdentity(): Promise<SiteIdentity> {
  const [setting, rows] = await Promise.all([
    db.orm.public.StoreSetting.where({ id: 1 }).first(),
    db.orm.public.SiteText.where((row) => row.key.in(Object.values(LEGACY_KEYS))).all(),
  ]);
  const legacy = (key: string) => rows.find((row) => row.key === key)?.value.trim();

  return {
    brandName: setting?.brandName?.trim() || legacy(LEGACY_KEYS.brandName) || BRAND_NAME,
    tagline: setting?.tagline?.trim() || legacy(LEGACY_KEYS.tagline) || DEFAULT_TAGLINE,
    instagram: (setting?.instagram?.trim() || legacy(LEGACY_KEYS.instagram) || "").replace(/^@/, ""),
  };
}
