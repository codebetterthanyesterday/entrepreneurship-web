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

/**
 * The business name, its one-line tagline and its Instagram handle, for the
 * header, the footer and the splash screen.
 *
 * Written by the admin in Admin → Pengaturan → Identitas toko (`StoreSetting`).
 * A field left empty there falls back to the default.
 */
export async function getSiteIdentity(): Promise<SiteIdentity> {
  const setting = await db.orm.public.StoreSetting.where({ id: 1 }).first();

  return {
    brandName: setting?.brandName?.trim() || BRAND_NAME,
    tagline: setting?.tagline?.trim() || DEFAULT_TAGLINE,
    instagram: (setting?.instagram?.trim() ?? "").replace(/^@/, ""),
  };
}
