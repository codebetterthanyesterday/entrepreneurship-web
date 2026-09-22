import { prisma as db } from "@/lib/prisma";
import { NotFoundError, StaleContentError } from "@/lib/errors";
import { SITE_TEXT_DEFAULTS, type SiteListSection, type SiteTextKey } from "@/lib/site-content";
import type {
  MoveSiteListItemInput,
  UpdateSiteTextInput,
  UpsertSiteListItemInput,
} from "@/lib/validations/site.schema";

/**
 * Saving a text block.
 *
 * Neither branch is a read-then-write. Two admins editing the same block at the
 * same time is exactly the race this project guards against everywhere else, and
 * prose deserves the same treatment: the predicate that decides whether the save
 * is allowed lives inside the statement, and the database evaluates it.
 *
 * For an existing row the guard is `WHERE key = ? AND version = ?` — the version
 * the editor loaded. The ORM's `update` returns nothing when no row matched,
 * which is the same signal as "zero rows affected" and keeps `updatedAt` on the
 * ORM's own path.
 *
 * `version: 0` means the editor was looking at the built-in default, so there is
 * no row yet. That becomes an INSERT with `ON CONFLICT DO NOTHING`, which loses
 * the race the same way if another admin created the row first. It has to be raw
 * SQL — the ORM cannot express the conflict clause — and going around the ORM
 * makes `updatedAt` this function's job, because `temporal.updatedAt()` only
 * fires on ORM writes and the column is NOT NULL with no database default.
 */
export async function saveSiteText({ key, value, version }: UpdateSiteTextInput) {
  const textKey = key as SiteTextKey;

  if (version === 0) {
    const insert = db.raw
      .sql`INSERT INTO "public"."siteText" ("key", "value", "version", "updatedAt") VALUES (${textKey}, ${value}, 1, NOW()) ON CONFLICT ("key") DO NOTHING`
      .affectedCount()
      .build();

    const { affectedRows } = await db.runtime().execute(insert);
    if (affectedRows === 0) {
      throw new StaleContentError(await readCurrentText(textKey));
    }

    return { key: textKey, value, version: 1 };
  }

  const updated = await db.orm.public.SiteText.where({ key: textKey, version }).update({
    value,
    // Safe as a plain literal rather than `version + 1` in SQL: the predicate
    // above pins the row to exactly this version, so nothing else can have
    // moved it between the read and this write.
    version: version + 1,
  });

  if (!updated) {
    throw new StaleContentError(await readCurrentText(textKey));
  }

  return { key: textKey, value, version: version + 1 };
}

/**
 * Deleting the row puts the block back to the default in `site-content.ts`,
 * which is what "reset" means for text — there is nothing else to restore to.
 */
export async function resetSiteText(key: SiteTextKey) {
  await db.orm.public.SiteText.where({ key }).delete();

  return { key, value: SITE_TEXT_DEFAULTS[key], version: 0 };
}

async function readCurrentText(key: SiteTextKey): Promise<string> {
  const row = await db.orm.public.SiteText.where({ key }).first();

  return row?.value ?? SITE_TEXT_DEFAULTS[key];
}

export async function upsertSiteListItem(input: UpsertSiteListItemInput) {
  const fields = {
    title: input.title,
    body: emptyToNull(input.body),
    icon: emptyToNull(input.icon),
    imageUrl: emptyToNull(input.imageUrl),
  };

  if (!input.id) {
    // Append to the end of its own list. `sortOrder` is only ever compared
    // within a section, so gaps left by deletions do not matter.
    const last = await db.orm.public.SiteListItem.where({ section: input.section })
      .orderBy((item) => item.sortOrder.desc())
      .first();

    return await db.orm.public.SiteListItem.create({
      section: input.section,
      ...fields,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    });
  }

  const version = input.version ?? 1;

  // Same guard as a text block, for the same reason.
  const updated = await db.orm.public.SiteListItem.where({ id: input.id, version }).update({
    ...fields,
    version: version + 1,
  });

  if (!updated) {
    const existing = await db.orm.public.SiteListItem.where({ id: input.id }).first();
    if (!existing) throw new NotFoundError("Itemnya udah dihapus orang lain");

    throw new StaleContentError(existing.title);
  }

  return updated;
}

export async function deleteSiteListItem(id: string) {
  const existing = await db.orm.public.SiteListItem.where({ id }).first();
  if (!existing) throw new NotFoundError("Itemnya nggak ketemu");

  await db.orm.public.SiteListItem.where({ id }).delete();

  return { section: existing.section as SiteListSection };
}

/**
 * Moving an item one place up or down.
 *
 * The two rows swap `sortOrder` inside one transaction, so a reader never catches
 * both items claiming the same place. Buttons rather than dragging was deliberate:
 * this runs on phones, and swapping two neighbours describes the operation
 * completely either way.
 */
export async function moveSiteListItem({ id, direction }: MoveSiteListItemInput) {
  const item = await db.orm.public.SiteListItem.where({ id }).first();
  if (!item) throw new NotFoundError("Itemnya nggak ketemu");

  const siblings = await db.orm.public.SiteListItem.where({ section: item.section })
    .orderBy((row) => row.sortOrder.asc())
    .all();

  const index = siblings.findIndex((row) => row.id === id);
  const neighbour = siblings[direction === "up" ? index - 1 : index + 1];

  // Already at the end it is being pushed towards. Not an error: the button is
  // drawn disabled, but a second tap that raced the re-render should not shout.
  if (!neighbour) return { section: item.section as SiteListSection, moved: false };

  await db.transaction(async (tx) => {
    await tx.orm.public.SiteListItem.where({ id: item.id }).update({
      sortOrder: neighbour.sortOrder,
    });
    await tx.orm.public.SiteListItem.where({ id: neighbour.id }).update({
      sortOrder: item.sortOrder,
    });
  });

  return { section: item.section as SiteListSection, moved: true };
}

/** Optional text inputs arrive as "" from a cleared field; NULL is what empty means. */
function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
