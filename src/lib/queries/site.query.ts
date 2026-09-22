import { prisma as db } from "@/lib/prisma";
import {
  SITE_TEXT_DEFAULTS,
  SITE_TEXT_KEYS,
  isSiteTextKey,
  type SiteListSection,
  type SiteTextKey,
} from "@/lib/site-content";

export interface SiteTextBlock {
  key: SiteTextKey;
  value: string;
  /**
   * The version the editor must send back when it saves. 0 means no row exists
   * yet and this is still the built-in default, which the service turns into an
   * insert rather than an update.
   */
  version: number;
}

export type SiteTexts = Record<SiteTextKey, SiteTextBlock>;

export interface SiteListRow {
  id: string;
  section: string;
  title: string;
  body: string | null;
  icon: string | null;
  imageUrl: string | null;
  sortOrder: number;
  version: number;
}

/**
 * Every text block, defaults filled in.
 *
 * One query for the whole page: the profile has fifteen or so blocks and
 * fetching them one at a time would be fifteen round-trips for a page that is
 * mostly static text. Keys in the database that the code no longer knows about
 * are ignored rather than rendered, so removing a key from `site-content.ts` is
 * safe without a data migration.
 */
export async function getSiteTexts(): Promise<SiteTexts> {
  const rows = await db.orm.public.SiteText.all();

  const texts = Object.fromEntries(
    SITE_TEXT_KEYS.map((key) => [key, { key, value: SITE_TEXT_DEFAULTS[key], version: 0 }]),
  ) as SiteTexts;

  for (const row of rows) {
    if (!isSiteTextKey(row.key)) continue;
    texts[row.key] = { key: row.key, value: row.value, version: row.version };
  }

  return texts;
}

/** One list, in the order the admin arranged it. */
export async function getSiteList(section: SiteListSection): Promise<SiteListRow[]> {
  const rows = await db.orm.public.SiteListItem.where({ section })
    .orderBy((item) => item.sortOrder.asc())
    .all();

  return rows.map(toSiteListRow);
}

/**
 * All three lists in one query.
 *
 * The profile page needs every list anyway, and they share a table, so one
 * ordered read beats three. Sorting per section happens here rather than in SQL
 * because the rows come back interleaved.
 */
export async function getSiteLists(): Promise<Record<SiteListSection, SiteListRow[]>> {
  const rows = await db.orm.public.SiteListItem.orderBy((item) => item.sortOrder.asc()).all();

  const lists: Record<SiteListSection, SiteListRow[]> = {
    advantage: [],
    team: [],
    gallery: [],
  };

  for (const row of rows) {
    const list = lists[row.section as SiteListSection];
    if (list) list.push(toSiteListRow(row));
  }

  return lists;
}

function toSiteListRow(row: {
  id: string;
  section: string;
  title: string;
  body: string | null;
  icon: string | null;
  imageUrl: string | null;
  sortOrder: number;
  version: number;
}): SiteListRow {
  // Plain values only — Prisma rows carry Temporal instants that cannot cross
  // the server/client boundary, and every one of these goes to a client editor.
  return {
    id: row.id,
    section: row.section,
    title: row.title,
    body: row.body ?? null,
    icon: row.icon ?? null,
    imageUrl: row.imageUrl ?? null,
    sortOrder: row.sortOrder,
    version: row.version,
  };
}
