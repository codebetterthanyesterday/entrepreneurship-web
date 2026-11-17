"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { cn, formatRupiah } from "@/lib/utils";
import { bundlesAvailable } from "@/lib/bundle";
import {
  createBundleAction,
  deleteBundleAction,
  toggleBundleActiveAction,
  updateBundleAction,
} from "@/actions/bundle.actions";
import type { AdminProduct } from "@/types/admin";

/** A paket as the admin page hands it to the browser: plain values only. */
export interface AdminBundle {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  sold: number;
  items: { productId: string; quantity: number }[];
}

export interface BundleManagerProps {
  bundles: AdminBundle[];
  products: AdminProduct[];
}

/**
 * The "Paket hemat" section of the admin's menu page.
 *
 * A paket has no stock of its own, so each card shows how many can still be
 * made from what is on the shelf, worked out the same way the catalogue does —
 * that number, not a typed one, is what the customer sees.
 */
export function BundleManager({ bundles, products }: BundleManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<AdminBundle | null | "new">(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const productById = React.useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const stockOf = (productId: string) => {
    const product = productById.get(productId);
    return product?.isActive ? product.stock : 0;
  };

  const toggle = async (bundle: AdminBundle) => {
    setBusyId(bundle.id);
    const result = await toggleBundleActiveAction(bundle.id);
    setBusyId(null);

    if (!result.ok) {
      toast(result.error);
      return;
    }

    toast(result.data.isActive ? `${bundle.name} tampil lagi di katalog` : `${bundle.name} disembunyiin`);
    router.refresh();
  };

  return (
    <section aria-labelledby="bundle-manager-title" className="mt-10 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="bundle-manager-title"
            className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink"
          >
            Paket hemat
          </h2>
          <p className="text-sm text-ink-soft">
            Stoknya ikut isi paket: tiap paket kejual motong stok tiap menu di dalamnya
          </p>
        </div>

        <Button size="sm" variant="primary" onClick={() => setEditing("new")} className="flex-none">
          + Paket
        </Button>
      </div>

      {bundles.length === 0 ? (
        <p className="rounded-[16px] border-[1.5px] border-dashed border-line p-4 text-sm text-ink-soft">
          Belum ada paket. Bikin satu, misalnya Chicken Roll + Milk Tea dengan harga lebih hemat.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 tablet:grid-cols-2 desktop:grid-cols-3">
          {bundles.map((bundle) => {
            const available = bundlesAvailable(bundle.items, stockOf);
            const normal = bundle.items.reduce(
              (sum, item) => sum + (productById.get(item.productId)?.price ?? 0) * item.quantity,
              0,
            );
            const hidden = bundle.items.some((item) => !productById.get(item.productId)?.isActive);

            return (
              <li
                key={bundle.id}
                className={cn(
                  "flex flex-col gap-2 rounded-[16px] border-[1.5px] border-line bg-white p-3.5",
                  !bundle.isActive && "opacity-70",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setEditing(bundle)}
                    className="min-w-0 text-left"
                    aria-label={`Ubah ${bundle.name}`}
                  >
                    <span className="block font-semibold text-ink">{bundle.name}</span>
                    <span className="block text-sm text-ink-soft tabular-nums">
                      {formatRupiah(bundle.price)}
                      {normal > bundle.price && (
                        <span className="ml-1.5 text-xs line-through">{formatRupiah(normal)}</span>
                      )}
                    </span>
                  </button>
                  <Switch
                    checked={bundle.isActive}
                    disabled={busyId === bundle.id}
                    onCheckedChange={() => void toggle(bundle)}
                    aria-label={`Tampilkan ${bundle.name} di katalog`}
                  />
                </div>

                <p className="text-xs leading-relaxed text-ink-soft">
                  {bundle.items
                    .map((item) => `${item.quantity}× ${productById.get(item.productId)?.name ?? "menu dihapus"}`)
                    .join(", ")}
                </p>

                <p
                  className={cn(
                    "text-xs font-semibold",
                    hidden || available === 0 ? "text-hot" : available <= 3 ? "text-warn" : "text-ok",
                  )}
                >
                  {hidden
                    ? "Ada isi yang disembunyiin, jadi paket ini nggak tampil"
                    : available === 0
                      ? "Isinya habis, belum bisa dijual"
                      : `Bisa dibikin ${available} paket lagi`}
                  <span className="font-medium text-ink-soft"> · terjual {bundle.sold}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {editing !== null && (
        <BundleFormSheet
          bundle={editing === "new" ? null : editing}
          products={products}
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

interface DraftItem {
  productId: string;
  quantity: number;
}

function BundleFormSheet({
  bundle,
  products,
  onClose,
  onSaved,
}: {
  bundle: AdminBundle | null;
  products: AdminProduct[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEditing = bundle !== null;
  const [name, setName] = React.useState(bundle?.name ?? "");
  const [description, setDescription] = React.useState(bundle?.description ?? "");
  const [price, setPrice] = React.useState(bundle ? String(bundle.price) : "");
  const [imageUrl, setImageUrl] = React.useState(bundle?.imageUrl ?? "");
  const [items, setItems] = React.useState<DraftItem[]>(
    bundle?.items ?? [
      { productId: "", quantity: 1 },
      { productId: "", quantity: 1 },
    ],
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<{ message: string; field?: string } | null>(null);
  // Deleting takes two taps: the first arms the button, the second deletes.
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);
  const generalError = error && (!error.field || error.field.startsWith("items")) ? error.message : null;

  const normal = items.reduce(
    (sum, item) => sum + (products.find((product) => product.id === item.productId)?.price ?? 0) * item.quantity,
    0,
  );

  const setItem = (index: number, next: Partial<DraftItem>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...next } : item)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      price: Number(price.replace(/\D/g, "")),
      imageUrl: imageUrl.trim() || null,
      isActive: bundle?.isActive ?? true,
      sortOrder: bundle?.sortOrder ?? 0,
      items: items.filter((item) => item.productId !== ""),
    };

    const result = isEditing
      ? await updateBundleAction(bundle.id, payload)
      : await createBundleAction(payload);

    setIsSaving(false);

    if (!result.ok) {
      setError({ message: result.error, field: result.field });
      return;
    }

    onSaved(isEditing ? "Paketnya udah diperbarui!" : "Paket barunya udah masuk katalog!");
  };

  const remove = async () => {
    if (!bundle) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsSaving(true);
    const result = await deleteBundleAction(bundle.id);
    setIsSaving(false);

    if (!result.ok) {
      setError({ message: result.error });
      return;
    }

    onSaved(`${bundle.name} udah dihapus`);
  };

  return (
    <Sheet open onClose={() => !isSaving && onClose()} title={isEditing ? "Ubah paket" : "Paket baru"}>
      <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
        {generalError && (
          <div className="rounded-[12px] border border-hot/20 bg-hot-soft p-3 text-sm font-medium text-hot">
            {generalError}
          </div>
        )}

        <Input
          label="Nama paket"
          placeholder="Misal: Little Power Combo"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldError("name")}
          disabled={isSaving}
        />

        <Input
          label="Deskripsi (opsional)"
          placeholder="Misal: Paduan gurih renyah dan manis segar"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={fieldError("description")}
          disabled={isSaving}
        />

        <fieldset className="flex flex-col gap-2" disabled={isSaving}>
          <legend className="mb-1.5 text-sm font-medium text-ink">Isi paket</legend>

          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                aria-label={`Menu isi ke-${index + 1}`}
                value={item.productId}
                onChange={(event) => setItem(index, { productId: event.target.value })}
                className="min-h-[44px] min-w-0 flex-1 rounded-[12px] border-[1.5px] border-line bg-white px-3 text-sm text-ink"
              >
                <option value="">Pilih menu…</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                    {product.isActive ? "" : " (disembunyiin)"}
                  </option>
                ))}
              </select>
              <Stepper
                value={item.quantity}
                min={1}
                max={20}
                label={`Jumlah isi ke-${index + 1}`}
                onChange={(quantity) => setItem(index, { quantity })}
              />
              <button
                type="button"
                aria-label={`Hapus isi ke-${index + 1}`}
                disabled={items.length <= 2}
                onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] text-ink-soft hover:bg-hot-soft hover:text-hot disabled:opacity-30"
              >
                &times;
              </button>
            </div>
          ))}

          <Button
            type="button"
            variant="flat"
            size="sm"
            onClick={() => setItems((current) => [...current, { productId: "", quantity: 1 }])}
            disabled={items.length >= 10}
          >
            + Tambah isi
          </Button>
        </fieldset>

        <Input
          label="Harga paket (Rp)"
          inputMode="numeric"
          placeholder="25000"
          value={price}
          onChange={(event) => setPrice(event.target.value.replace(/\D/g, ""))}
          error={fieldError("price")}
          hint={normal > 0 ? `Kalau beli satuan: ${formatRupiah(normal)}` : undefined}
          disabled={isSaving}
        />

        <Input
          label="Alamat gambar (opsional)"
          placeholder="https://…"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          error={fieldError("imageUrl")}
          hint="Kosongin aja, nanti katalog nampilin gambar isi paketnya"
          disabled={isSaving}
        />

        <div className="flex flex-col gap-2 pt-1">
          <Button type="submit" variant="primary" fullWidth isLoading={isSaving}>
            {isEditing ? "Simpan perubahan" : "Simpan paket"}
          </Button>
          {isEditing && (
            <Button type="button" variant="flat" fullWidth onClick={() => void remove()} disabled={isSaving}>
              {confirmDelete ? "Yakin? Ketuk sekali lagi buat hapus" : "Hapus paket"}
            </Button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
