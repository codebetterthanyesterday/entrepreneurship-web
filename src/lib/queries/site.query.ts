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

/**
 * The business name, its one-line tagline and its Instagram handle, for the
 * header and footer.
 *
 * The company profile and its in-page editor are gone (the site opens straight
 * on the menu), but the `SiteText` rows an admin saved back then are kept, and
 * these three still name the business. Any other key in the table is ignored.
 */
export async function getSiteIdentity(): Promise<SiteIdentity> {
  const rows = await db.orm.public.SiteText.all();
  const value = (key: string) => rows.find((row) => row.key === key)?.value.trim();

  return {
    brandName: value("hero.title") || BRAND_NAME,
    tagline: value("footer.tagline") || "Pesan sekarang, ambil di Market Day atau diantar.",
    instagram: (value("contact.instagram") ?? "").replace(/^@/, ""),
  };
}
