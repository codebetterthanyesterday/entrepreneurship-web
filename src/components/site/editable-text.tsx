"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { resetSiteTextAction, updateSiteTextAction } from "@/actions/site.actions";
import { MULTILINE_KEYS, OPTIONAL_KEYS, toParagraphs, type SiteTextKey } from "@/lib/site-content";

// `dd` is in the list because the contact band is a description list: a <dt>
// without a <dd> is not a valid pair, and a <div> in its place leaves the term
// dangling for anyone reading the page through its structure.
type TextTag = "h1" | "h2" | "h3" | "p" | "span" | "div" | "dd";

export interface EditableTextProps {
  textKey: SiteTextKey;
  value: string;
  /** The version loaded with `value`; 0 means it is still the built-in default. */
  version: number;
  /** False for a customer, and for an admin who has not switched edit mode on. */
  editing: boolean;
  as?: TextTag;
  className?: string;
  /** Shown in place of nothing when an optional block is empty and being edited. */
  placeholder?: string;
}

/**
 * One text block of the company profile, readable by everyone and editable in
 * place by an admin.
 *
 * Read mode renders the plain element and nothing else — a customer's page
 * carries no editing markup at all, because `editing` is decided on the server.
 *
 * Saving sends the version the block was loaded with. If another admin saved
 * first, the action comes back with the text that won and this shows it instead
 * of the losing draft, so nobody's writing disappears without being seen.
 */
export function EditableText({
  textKey,
  value,
  version,
  editing,
  as = "p",
  className,
  placeholder,
}: EditableTextProps) {
  const Tag = as;
  const router = useRouter();
  const { toast } = useToast();

  const multiline = MULTILINE_KEYS.includes(textKey);
  const optional = OPTIONAL_KEYS.includes(textKey);

  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [saving, setSaving] = React.useState(false);

  // The server is the source of truth: after a save or a refresh the props carry
  // the new text and version, and any stale draft is dropped.
  //
  // Adjusted during render rather than in an effect. That is React's own advice
  // for resetting state when a prop changes — an effect would render once with
  // the stale draft still on screen and then again to correct it.
  const [synced, setSynced] = React.useState({ value, version });
  if (synced.value !== value || synced.version !== version) {
    setSynced({ value, version });
    setDraft(value);
    setOpen(false);
  }

  const render = () => {
    if (!multiline) return value;

    // Spacing in `em`, so the gap between paragraphs grows with the type rather
    // than staying at whatever looked right in one place.
    return toParagraphs(value).map((paragraph, index) => (
      <span key={index} className="block [&:not(:first-child)]:mt-[0.9em]">
        {paragraph}
      </span>
    ));
  };

  if (!editing) {
    // An empty optional block is simply absent for a customer — an Instagram
    // handle nobody has filled in should not print an empty line.
    if (value.trim().length === 0) return null;

    return <Tag className={className}>{render()}</Tag>;
  }

  if (!open) {
    return (
      <Tag className={cn(className, "relative")}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "text-left w-full rounded-[10px] -mx-1 px-1 transition-colors",
            "border border-dashed border-pink hover:bg-pink-soft/60",
            "focus-visible:bg-pink-soft/60",
          )}
          aria-label={`Ubah teks: ${textKey}`}
        >
          {value.trim().length > 0 ? (
            render()
          ) : (
            <span className="text-ink-soft italic">{placeholder ?? "Belum diisi"}</span>
          )}
        </button>
      </Tag>
    );
  }

  const save = async () => {
    setSaving(true);
    const result = await updateSiteTextAction({ key: textKey, value: draft, version });
    setSaving(false);

    if (result.ok) {
      toast("Tersimpan");
      setOpen(false);
      router.refresh();
      return;
    }

    toast(result.error);

    // A lost race hands back the text that won it. Show that, so the admin sees
    // what is actually stored rather than their own rejected draft.
    if ("current" in result) {
      setDraft(result.current);
      router.refresh();
    }
  };

  const reset = async () => {
    setSaving(true);
    const result = await resetSiteTextAction({ key: textKey });
    setSaving(false);

    toast(result.ok ? "Dikembalikan ke teks bawaan" : result.error);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    }
  };

  const field =
    "w-full bg-white border-[1.5px] border-pink rounded-[14px] px-3 py-2 text-ink text-[16px] placeholder:text-ink-soft";

  // Inside a description list only <dt> and <dd> are allowed next to each other,
  // so the editor keeps the <dd> around itself rather than replacing it with a
  // bare div. Every other tag drops out while editing on purpose — a form nested
  // inside an <h1> would be worse than the div it replaces.
  const Editor = as === "dd" ? "dd" : "div";

  return (
    <Editor className="my-1 rounded-[16px] bg-white border-[1.5px] border-pink-soft shadow-lg p-3 flex flex-col gap-2 text-ink">
      {multiline ? (
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={6}
          autoFocus
          className={cn(field, "resize-y leading-relaxed")}
          aria-label={`Teks ${textKey}`}
          placeholder={placeholder}
        />
      ) : (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoFocus
          className={cn(field, "min-h-[46px]")}
          aria-label={`Teks ${textKey}`}
          placeholder={placeholder}
        />
      )}

      {multiline && (
        <p className="text-[11.5px] text-ink-soft">
          Satu baris kosong di antara paragraf bikin paragraf baru.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} isLoading={saving}>
          Simpan
        </Button>
        <Button
          size="sm"
          variant="flat"
          onClick={() => {
            setDraft(value);
            setOpen(false);
          }}
          disabled={saving}
        >
          Batal
        </Button>

        {version > 0 && (
          <Button size="sm" variant="ghost" onClick={reset} disabled={saving}>
            Teks bawaan
          </Button>
        )}

        {optional && (
          <span className="text-[11.5px] text-ink-soft">
            Boleh dikosongkan — kalau kosong, bagian ini nggak ditampilkan.
          </span>
        )}
      </div>
    </Editor>
  );
}
