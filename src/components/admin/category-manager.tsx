"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";
import {
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  renameCategoryAction,
} from "@/actions/category.actions";
import type { CategoryWithCount } from "@/lib/services/category.service";
import type { ActionResult } from "@/lib/action-result";

export interface CategoryManagerProps {
  categories: CategoryWithCount[];
}

type Editing = { mode: "create" } | { mode: "rename"; category: CategoryWithCount };

/**
 * Admin → Menu → Kategori: add a category, rename one, move it up or down
 * (the catalogue's shelves and the till's tabs follow this order), or delete
 * it. Deleting never deletes menu items: they move to "Tanpa kategori" and
 * stay on sale, which the confirmation says in numbers.
 */
export function CategoryManager({ categories }: CategoryManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const run = async <T,>(id: string, action: () => Promise<ActionResult<T>>, done?: (data: T) => string) => {
    setBusy(id);
    const result = await action();
    setBusy(null);
    setConfirming(null);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    if (done) toast(done(result.data));
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">{categories.length} kategori</p>
        <Button variant="primary" size="sm" onClick={() => setEditing({ mode: "create" })}>
          Tambah kategori
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="s-slab p-4 text-sm text-ink-soft">
          Belum ada kategori. Semua menu tampil di satu rak, Lainnya.
        </p>
      ) : (
        <ol className="flex flex-col gap-2.5" aria-label="Kategori menu">
          {categories.map((category, index) => (
            <li key={category.id} className="s-slab flex flex-col gap-2.5 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-extrabold text-[15px] text-ink break-words">{category.name}</p>
                  <p className="text-[13px] text-ink-soft">
                    {category.products === 0 ? "Belum ada menu" : `${category.products} menu`}
                  </p>
                </div>
                <div className="flex flex-none gap-1.5">
                  <MoveButton
                    label={`Naikkan ${category.name}`}
                    disabled={busy !== null || index === 0}
                    onClick={() => run(category.id, () => moveCategoryAction({ id: category.id, by: -1 }))}
                  >
                    <path d="M6 15l6-6 6 6" />
                  </MoveButton>
                  <MoveButton
                    label={`Turunkan ${category.name}`}
                    disabled={busy !== null || index === categories.length - 1}
                    onClick={() => run(category.id, () => moveCategoryAction({ id: category.id, by: 1 }))}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </MoveButton>
                </div>
              </div>

              {confirming === category.id ? (
                <div className="flex flex-col gap-2 rounded-[12px] bg-warn-soft p-3 text-[13px] text-warn">
                  <p>
                    Hapus kategori {category.name}?{" "}
                    {category.products === 0
                      ? "Belum ada menu di dalamnya."
                      : `${category.products} menu di dalamnya nggak ikut terhapus; pindah ke Tanpa kategori dan tetap dijual.`}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      isLoading={busy === category.id}
                      onClick={() =>
                        run(
                          category.id,
                          () => deleteCategoryAction(category.id),
                          ({ moved }) =>
                            moved === 0
                              ? `Kategori ${category.name} dihapus`
                              : `Kategori ${category.name} dihapus; ${moved} menu pindah ke Tanpa kategori`,
                        )
                      }
                    >
                      Ya, hapus
                    </Button>
                    <Button size="sm" variant="flat" onClick={() => setConfirming(null)}>
                      Batal
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    aria-label={`Ganti nama ${category.name}`}
                    disabled={busy !== null}
                    onClick={() => setEditing({ mode: "rename", category })}
                  >
                    Ganti nama
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    aria-label={`Hapus ${category.name}`}
                    disabled={busy !== null}
                    onClick={() => setConfirming(category.id)}
                  >
                    Hapus
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {editing && (
        <CategoryFormSheet
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            toast(message);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function CategoryFormSheet({
  editing,
  onClose,
  onSaved,
}: {
  editing: Editing;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const category = editing.mode === "rename" ? editing.category : null;
  const [name, setName] = React.useState(category?.name ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<{ message: string; field?: string } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = category
      ? await renameCategoryAction({ id: category.id, name })
      : await createCategoryAction({ name });
    setSaving(false);
    if (!result.ok) return setError({ message: result.error, field: result.field });
    onSaved(category ? `Namanya jadi ${result.data.name}` : `Kategori ${result.data.name} ditambahkan`);
  };

  return (
    <Sheet open onClose={onClose} title={category ? "Ganti nama kategori" : "Tambah kategori"}>
      <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
        {error && error.field !== "name" && <div className="s-alert text-sm font-semibold">{error.message}</div>}
        <Input
          label="Nama kategori"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={error?.field === "name" ? error.message : undefined}
          hint={category ? "Menu di dalamnya tetap di kategori ini" : "Ditaruh paling bawah; geser urutannya setelah disimpan"}
          maxLength={40}
          disabled={saving}
        />
        <div className="flex flex-col gap-2 pt-1">
          <Button type="submit" variant="primary" fullWidth isLoading={saving}>
            {category ? "Simpan" : "Tambah"}
          </Button>
          <Button type="button" variant="flat" fullWidth onClick={onClose} disabled={saving}>
            Batal
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-[10px] border-[1.5px] border-line bg-white text-ink transition-colors hover:bg-cream disabled:opacity-35"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[2.2]" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
