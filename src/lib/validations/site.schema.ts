import { z } from "zod";
import {
  isSiteListSection,
  isSiteTextKey,
  OPTIONAL_KEYS,
  SITE_LIST_SECTIONS,
  type SiteTextKey,
} from "@/lib/site-content";

const siteTextKey = z.string().refine(isSiteTextKey, "Blok teksnya nggak dikenal");

const siteListSection = z.enum(SITE_LIST_SECTIONS);

/**
 * A link field the admin may also clear.
 *
 * Follows `qrisImageUrl` in the settings schema: a real URL or an empty string,
 * and the action turns the empty string into NULL.
 */
const optionalUrl = z.union([z.string().url("Link gambarnya belum benar"), z.literal("")]);

export const updateSiteTextSchema = z
  .object({
    key: siteTextKey,
    value: z.string().max(2000, "Teksnya kepanjangan, maksimal 2000 karakter"),
    /**
     * The version the editor loaded. 0 means "there was no row yet, I am still
     * looking at the built-in default", which the service turns into an insert.
     */
    version: z.number().int().min(0),
  })
  .refine(
    ({ key, value }) =>
      (OPTIONAL_KEYS as readonly string[]).includes(key) || value.trim().length > 0,
    { message: "Teksnya nggak boleh kosong", path: ["value"] },
  );

/**
 * One list row. Which fields matter depends on the section — `SITE_LIST_SHAPES`
 * in `site-content.ts` is the table — but every section needs a title, so that
 * is the only field required here.
 */
export const upsertSiteListItemSchema = z.object({
  id: z.string().min(1).optional().nullable(),
  section: siteListSection,
  title: z.string().trim().min(1, "Judulnya belum diisi").max(120, "Judulnya kepanjangan"),
  body: z.string().max(400, "Keterangannya kepanjangan").optional().nullable(),
  icon: z.string().max(40).optional().nullable(),
  imageUrl: optionalUrl.optional().nullable(),
  version: z.number().int().min(1).optional().nullable(),
});

export const siteListItemIdSchema = z.object({
  id: z.string().min(1, "Itemnya nggak ketemu"),
});

export const moveSiteListItemSchema = z.object({
  id: z.string().min(1, "Itemnya nggak ketemu"),
  direction: z.enum(["up", "down"]),
});

export type UpdateSiteTextInput = z.infer<typeof updateSiteTextSchema>;
export type UpsertSiteListItemInput = z.infer<typeof upsertSiteListItemSchema>;
export type MoveSiteListItemInput = z.infer<typeof moveSiteListItemSchema>;

/** Narrowed for callers that already validated, so the service keys stay typed. */
export type ValidatedSiteTextKey = SiteTextKey;

export { isSiteListSection };
