import { BRAND_NAME } from "@/lib/brand";

/**
 * The company profile's content model.
 *
 * Text blocks have defaults here in code, and a row in `SiteText` only ever
 * *overrides* one. That is what lets a fresh database — or a key added in a
 * later release — render a complete page instead of a row of blanks, and it
 * means "reset to default" is just deleting a row.
 *
 * Lists (advantages, team, gallery) deliberately have no defaults: an empty list
 * has to be a state the admin can actually reach. If an empty list fell back to
 * built-in items, deleting the last one would make them all reappear. A fresh
 * database gets its starting advantages from `prisma/seed.ts` instead.
 */

/**
 * Remembers whether an admin asked to edit the public pages.
 *
 * A preference, not a permission: the server renders the edit controls only for
 * a signed-in ADMIN, and every action re-checks the role, so setting this cookie
 * by hand gets a visitor nothing. It is a cookie rather than client state
 * because the *server* decides what the page contains — an empty gallery is
 * drawn for an editing admin and left out of a customer's HTML entirely.
 */
export const EDIT_MODE_COOKIE = "site-edit";

export const SITE_TEXT_KEYS = [
  "hero.title",
  "hero.tagline",
  "hero.ctaLabel",
  "story.heading",
  "story.body",
  "advantages.heading",
  "menu.heading",
  "menu.note",
  "team.heading",
  "gallery.heading",
  "contact.heading",
  "contact.schedule",
  "contact.location",
  "contact.instagram",
  "footer.tagline",
] as const;

export type SiteTextKey = (typeof SITE_TEXT_KEYS)[number];

/**
 * Blocks whose text is a paragraph rather than a line. They are edited in a
 * textarea and rendered as one `<p>` per blank-line-separated paragraph; every
 * other key is a single line edited in an input.
 */
export const MULTILINE_KEYS: readonly SiteTextKey[] = ["story.body", "contact.schedule"];

/**
 * Blocks that are allowed to be empty, because an empty one means "don't show
 * this at all" — an Instagram handle nobody has yet should not print a dead
 * link. Every other block must keep some text, or the page loses its structure.
 */
export const OPTIONAL_KEYS: readonly SiteTextKey[] = ["contact.instagram"];

export const SITE_TEXT_DEFAULTS: Readonly<Record<SiteTextKey, string>> = {
  "hero.title": BRAND_NAME,
  "hero.tagline":
    "Jajanan buatan tim kami sendiri. Dipesan dari mana saja, diambil pas Market Day.",
  "hero.ctaLabel": "Lihat menu",

  "story.heading": "Tentang kami",
  "story.body":
    "Kami tim jajanan di Market Day sekolah, dan semuanya kami kerjakan sendiri — dari menyusun resep, menghitung harga, belanja bahan, sampai menjaga booth pada hari acara.\n\nSistem pesanan ini kami bikin supaya antrean di booth tidak menumpuk: pelanggan bisa memilih dan memesan lebih dulu, lalu cukup datang untuk mengambil.",

  "advantages.heading": "Kenapa pilih kami",

  "menu.heading": "Menu singkat",
  "menu.note": "Ini daftar ringkasnya. Stok terbaru dan tombol pesan ada di halaman Menu.",

  "team.heading": "Tim kami",
  "gallery.heading": "Galeri",

  "contact.heading": "Jadwal, lokasi & kontak",
  "contact.schedule":
    "Kami buka pada hari Market Day sekolah.\nCek pengumuman kelas untuk tanggal terbarunya.",
  "contact.location": "Booth kami, area kantin sekolah.",
  "contact.instagram": "",

  "footer.tagline": "Pesan sekarang, ambil pas Market Day.",
};

/** The three editable lists. `section` is the discriminator stored on each row. */
export const SITE_LIST_SECTIONS = ["advantage", "team", "gallery"] as const;

export type SiteListSection = (typeof SITE_LIST_SECTIONS)[number];

export function isSiteListSection(value: string): value is SiteListSection {
  return (SITE_LIST_SECTIONS as readonly string[]).includes(value);
}

export function isSiteTextKey(value: string): value is SiteTextKey {
  return (SITE_TEXT_KEYS as readonly string[]).includes(value);
}

/**
 * What each list calls its columns, and what a blank one should say.
 *
 * One table backs all three lists, so the labels that turn `title`/`body`/
 * `imageUrl` into "Nama"/"Peran"/"Foto" live here rather than being retyped in
 * each section's component.
 */
export interface SiteListShape {
  /** Heading key this list sits under, for the "add" button's wording. */
  itemNoun: string;
  titleLabel: string;
  titlePlaceholder: string;
  bodyLabel: string | null;
  bodyPlaceholder: string;
  /** Whether the list uses an icon (advantages) or an image URL (team, gallery). */
  visual: "icon" | "image" | "none";
  imageLabel: string;
  /** Shown in place of the list when it is empty and the viewer can edit it. */
  emptyHint: string;
}

export const SITE_LIST_SHAPES: Readonly<Record<SiteListSection, SiteListShape>> = {
  advantage: {
    itemNoun: "keunggulan",
    titleLabel: "Judul",
    titlePlaceholder: "Selalu fresh",
    bodyLabel: "Penjelasan",
    bodyPlaceholder: "Dibikin pagi hari, jadi pas kamu ambil masih enak.",
    visual: "icon",
    imageLabel: "Ikon",
    emptyHint: "Belum ada keunggulan. Tambahkan tiga atau empat hal yang bikin jajanan kamu beda.",
  },
  team: {
    itemNoun: "anggota tim",
    titleLabel: "Nama",
    titlePlaceholder: "Nadia",
    bodyLabel: "Peran",
    bodyPlaceholder: "Kasir & keuangan",
    visual: "image",
    imageLabel: "Link foto",
    emptyHint: "Belum ada anggota tim. Tambahkan nama dan perannya masing-masing.",
  },
  gallery: {
    itemNoun: "foto",
    titleLabel: "Keterangan",
    titlePlaceholder: "Booth kami pas Market Day",
    bodyLabel: null,
    bodyPlaceholder: "",
    visual: "image",
    imageLabel: "Link foto",
    emptyHint: "Belum ada foto. Tempel link gambar untuk mulai mengisi galeri.",
  },
};

/** Splits a stored paragraph block into the paragraphs it should render as. */
export function toParagraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}
