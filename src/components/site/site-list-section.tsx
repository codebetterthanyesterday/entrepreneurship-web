"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  deleteSiteListItemAction,
  moveSiteListItemAction,
  upsertSiteListItemAction,
} from "@/actions/site.actions";
import { SITE_LIST_SHAPES, type SiteListSection as Section } from "@/lib/site-content";
import { SITE_ICON_KEYS, SiteIconGlyph, toSiteIcon } from "@/components/site/site-icons";
import { Reveal, revealDelay } from "@/components/site/reveal";
import type { SiteListRow } from "@/lib/queries/site.query";

export interface SiteListSectionProps {
  section: Section;
  items: readonly SiteListRow[];
  editing: boolean;
}

/**
 * One of the profile's three lists — keunggulan, tim, galeri.
 *
 * They share a table and a set of controls, so they share a component; only the
 * read-mode layout differs, and `SITE_LIST_SHAPES` supplies the words that turn
 * `title`/`body`/`imageUrl` into "Nama"/"Peran"/"Foto".
 *
 * Reordering is two buttons rather than dragging. The list is short, the screen
 * is usually a phone, and a swap of two neighbours is the whole operation —
 * dragging would have cost a library and a separate keyboard path for the same
 * result.
 */
export function SiteListSection({ section, items, editing }: SiteListSectionProps) {
  const shape = SITE_LIST_SHAPES[section];
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);

  const add = async () => {
    setAdding(true);
    // Created with placeholder text and edited in place, rather than behind a
    // separate "new item" form — the item appears where it will live, and the
    // admin types over it.
    const result = await upsertSiteListItemAction({
      section,
      title: shape.titlePlaceholder,
      body: shape.bodyLabel ? shape.bodyPlaceholder : null,
      icon: shape.visual === "icon" ? SITE_ICON_KEYS[0] : null,
    });
    setAdding(false);

    toast(result.ok ? `${shape.itemNoun} ditambahkan` : result.error);
    if (result.ok) router.refresh();
  };

  if (!editing) {
    if (items.length === 0) return null;

    return <ReadList section={section} items={items} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && (
        <p className="text-sm text-ink-soft bg-white/70 border-[1.5px] border-dashed border-line rounded-[14px] p-3">
          {shape.emptyHint}
        </p>
      )}

      {items.map((item, index) => (
        <ItemEditor
          key={item.id}
          section={section}
          item={item}
          isFirst={index === 0}
          isLast={index === items.length - 1}
        />
      ))}

      <Button variant="ghost" size="sm" onClick={add} isLoading={adding} className="self-start">
        + Tambah {shape.itemNoun}
      </Button>
    </div>
  );
}

/**
 * What a customer sees.
 *
 * Three genuinely different layouts, which is the point. Giving all three the
 * same white rounded card with a 1.5px border was what made the page read as a
 * template: a bento of identical boxes, where nothing is more important than
 * anything else. Here the advantages are a numbered editorial list separated by
 * hairlines, the team is a row of portraits with no frames at all, and the
 * gallery is an uninterrupted grid of images.
 */
function ReadList({ section, items }: { section: Section; items: readonly SiteListRow[] }) {
  if (section === "advantage") {
    return (
      <ul className="grid gap-0 desktop:grid-cols-2 desktop:gap-x-14">
        {items.map((item, index) => (
          <Reveal
            as="li"
            key={item.id}
            delayMs={revealDelay(index)}
            className="border-t border-sand-line py-6 flex gap-4"
          >
            <span className="flex-none pt-1 text-pink-deep" aria-hidden="true">
              <SiteIconGlyph name={toSiteIcon(item.icon)} className="w-6 h-6" />
            </span>

            <div className="min-w-0">
              {/* The ordinal is decoration, not content — a screen reader already
                  gets the list semantics from <ul>/<li>. */}
              <span className="eyebrow text-ink-soft/70" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="display-3 mt-1.5 text-ink">{item.title}</h3>
              {item.body && (
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft max-w-[38ch]">
                  {item.body}
                </p>
              )}
            </div>
          </Reveal>
        ))}
      </ul>
    );
  }

  if (section === "team") {
    return (
      <ul className="grid grid-cols-2 gap-x-5 gap-y-8 tablet:grid-cols-3 desktop:grid-cols-4">
        {items.map((item, index) => (
          <Reveal as="li" key={item.id} delayMs={revealDelay(index)} className="flex flex-col gap-3">
            <Avatar name={item.title} imageUrl={item.imageUrl} />
            <div>
              <h3 className="text-[15px] font-semibold text-ink leading-snug">{item.title}</h3>
              {item.body && <p className="mt-0.5 text-[13px] text-ink-soft">{item.body}</p>}
            </div>
          </Reveal>
        ))}
      </ul>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2 tablet:grid-cols-3 desktop:grid-cols-4">
      {items.map((item, index) => (
        <Reveal as="li" key={item.id} delayMs={revealDelay(index)} className="group">
          <figure className="m-0">
            <div className="aspect-[4/5] overflow-hidden bg-sand">
              {item.imageUrl ? (
                // Plain <img>, as everywhere else in this project — there is no
                // image pipeline here, only URLs the admin pastes in.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-[12px] text-ink-soft px-3 text-center">
                  Fotonya belum diisi
                </span>
              )}
            </div>
            <figcaption className="mt-2 text-[12.5px] leading-snug text-ink-soft">
              {item.title}
            </figcaption>
          </figure>
        </Reveal>
      ))}
    </ul>
  );
}

function Avatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className="w-full aspect-[4/5] object-cover rounded-[4px]"
        loading="lazy"
      />
    );
  }

  // Initials, so a member with no photo yet is still a face-shaped thing in the
  // grid rather than a hole in it.
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <span
      aria-hidden="true"
      className="w-full aspect-[4/5] rounded-[4px] bg-white flex items-center justify-center font-[family-name:var(--font-display)] text-3xl text-pink-deep"
    >
      {initials || "?"}
    </span>
  );
}

function ItemEditor({
  section,
  item,
  isFirst,
  isLast,
}: {
  section: Section;
  item: SiteListRow;
  isFirst: boolean;
  isLast: boolean;
}) {
  const shape = SITE_LIST_SHAPES[section];
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = React.useState(item.title);
  const [body, setBody] = React.useState(item.body ?? "");
  const [imageUrl, setImageUrl] = React.useState(item.imageUrl ?? "");
  const [icon, setIcon] = React.useState(toSiteIcon(item.icon));
  const [busy, setBusy] = React.useState(false);

  // After any refresh the row from the server wins, including its new version.
  // Adjusted during render, not in an effect — see the note in `editable-text.tsx`.
  const [syncedVersion, setSyncedVersion] = React.useState(item.version);
  if (syncedVersion !== item.version) {
    setSyncedVersion(item.version);
    setTitle(item.title);
    setBody(item.body ?? "");
    setImageUrl(item.imageUrl ?? "");
    setIcon(toSiteIcon(item.icon));
  }

  const run = async (work: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true);
    const result = await work();
    setBusy(false);

    toast(result.ok ? done : (result.error ?? "Gagal"));
    if (result.ok) router.refresh();
  };

  const save = () =>
    run(
      () =>
        upsertSiteListItemAction({
          id: item.id,
          section,
          title,
          body: shape.bodyLabel ? body : null,
          icon: shape.visual === "icon" ? icon : null,
          imageUrl: shape.visual === "image" ? imageUrl : null,
          version: item.version,
        }),
      "Tersimpan",
    );

  const remove = () =>
    run(() => deleteSiteListItemAction({ id: item.id }), `${shape.itemNoun} dihapus`);

  const move = (direction: "up" | "down") =>
    run(() => moveSiteListItemAction({ id: item.id, direction }), "Urutan diubah");

  const field =
    "w-full bg-white border-[1.5px] border-line rounded-[12px] px-3 min-h-[44px] text-ink text-[16px] placeholder:text-ink-soft focus:border-pink";

  return (
    <div className="bg-white border-[1.5px] border-pink-soft shadow-lg rounded-[18px] p-3.5 flex flex-col gap-2.5 text-ink">
      <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-ink">
        {shape.titleLabel}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={field}
          placeholder={shape.titlePlaceholder}
        />
      </label>

      {shape.bodyLabel && (
        <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-ink">
          {shape.bodyLabel}
          <input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={field}
            placeholder={shape.bodyPlaceholder}
          />
        </label>
      )}

      {shape.visual === "image" && (
        <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-ink">
          {shape.imageLabel}
          <input
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            className={field}
            inputMode="url"
            placeholder="https://..."
          />
          <span className="font-normal text-[11.5px] text-ink-soft">
            Tempel link gambar. Boleh dikosongkan dulu.
          </span>
        </label>
      )}

      {shape.visual === "icon" && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-[12.5px] font-semibold text-ink">{shape.imageLabel}</legend>
          <div className="flex flex-wrap gap-1.5">
            {SITE_ICON_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                aria-pressed={icon === key}
                aria-label={`Ikon ${key}`}
                className={cn(
                  "w-11 h-11 rounded-[12px] flex items-center justify-center border-[1.5px] transition-colors",
                  icon === key
                    ? "bg-pink-deep text-white border-pink-deep"
                    : "bg-white text-ink-soft border-line hover:bg-cream",
                )}
              >
                <SiteIconGlyph name={key} className="w-5 h-5" />
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} isLoading={busy}>
          Simpan
        </Button>

        <div className="flex gap-1.5" role="group" aria-label={`Urutan ${item.title}`}>
          <IconButton label={`Naikkan ${item.title}`} onClick={() => move("up")} disabled={busy || isFirst}>
            ↑
          </IconButton>
          <IconButton label={`Turunkan ${item.title}`} onClick={() => move("down")} disabled={busy || isLast}>
            ↓
          </IconButton>
        </div>

        <Button size="sm" variant="flat" onClick={remove} disabled={busy} className="text-hot">
          Hapus
        </Button>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "w-11 h-11 rounded-[12px] bg-white border-[1.5px] border-line text-ink flex items-center justify-center text-lg",
        "hover:bg-cream disabled:opacity-40 disabled:cursor-default",
      )}
    >
      {children}
    </button>
  );
}
