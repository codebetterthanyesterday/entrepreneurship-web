"use client";

import * as React from "react";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";
import type { AdminCategory, AdminProduct, PrepType } from "@/types/admin";

const NEW_PRODUCT_STOCK = 10;
const QUICK_ADD = [5, 10, 25];

export interface ProductFormValues {
  name: string;
  price: number;
  stock: number;
  prepType: PrepType;
  isActive: boolean;
  categoryId: string | null;
}

export interface ProductFormSheetProps {
  open: boolean;
  /** `null` puts the sheet in "Menu baru" mode. */
  product: AdminProduct | null;
  categories: AdminCategory[];
  isSaving: boolean;
  error: { message: string; field?: string } | null;
  onClose: () => void;
  onSubmit: (values: ProductFormValues) => void;
}

interface SegmentedOption<T> {
  value: T;
  label: string;
}

function Segmented<T extends string | boolean>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-[46px] rounded-[14px] border-[1.5px] text-sm font-medium transition-colors",
                active
                  ? "bg-pink-soft border-pink text-pink-deep"
                  : "bg-white border-line text-ink-soft hover:bg-cream",
                disabled && "opacity-60",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProductFormSheet({
  open,
  product,
  categories,
  isSaving,
  error,
  onClose,
  onSubmit,
}: ProductFormSheetProps) {
  const isEditing = product !== null;

  // The parent mounts this sheet only while it is open, so the initial state is
  // the reset: every open starts from the product being edited.
  const [name, setName] = React.useState(product?.name ?? "");
  const [price, setPrice] = React.useState(product ? String(product.price) : "");
  const [stock, setStock] = React.useState(product?.stock ?? NEW_PRODUCT_STOCK);
  const [prepType, setPrepType] = React.useState<PrepType>(product?.prepType ?? "NEEDS_PREP");
  const [isActive, setIsActive] = React.useState(product?.isActive ?? true);
  const [categoryId, setCategoryId] = React.useState<string>(product?.categoryId ?? "");

  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);
  const generalError = error && !error.field ? error.message : null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    onSubmit({
      name: name.trim(),
      price: Number(price.replace(/\D/g, "")),
      stock,
      prepType,
      isActive,
      categoryId: categoryId === "" ? null : categoryId,
    });
  };

  return (
    <Sheet open={open} onClose={onClose} title={isEditing ? "Ubah menu" : "Menu baru"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pb-2">
        <p className="text-sm text-ink-soft -mt-1">
          {isEditing
            ? `${product.name} · sudah terjual ${product.sold} porsi`
            : "Tambah jualan baru ke katalog"}
        </p>

        {generalError && (
          <div className="bg-hot-soft text-hot text-sm font-medium p-3 rounded-[12px] border border-hot/20">
            {generalError}
          </div>
        )}

        <Input
          label="Nama menu"
          placeholder="Misal: Croffle Butter Sugar"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldError("name")}
          disabled={isSaving}
        />

        <Input
          label="Harga (Rp)"
          inputMode="numeric"
          placeholder="20000"
          value={price}
          onChange={(event) => setPrice(event.target.value.replace(/\D/g, ""))}
          error={fieldError("price")}
          disabled={isSaving}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Stok tersedia</span>
          <Stepper value={stock} onChange={setStock} min={0} max={999} disabled={isSaving} />
          <div className="flex gap-2 mt-1">
            {QUICK_ADD.map((amount) => (
              <button
                key={amount}
                type="button"
                disabled={isSaving}
                onClick={() => setStock((current) => Math.min(999, current + amount))}
                className="flex-1 min-h-[44px] rounded-[11px] bg-cream border-[1.5px] border-line text-xs font-semibold text-ink-soft hover:border-pink hover:text-pink-deep transition-colors disabled:opacity-60"
              >
                +{amount}
              </button>
            ))}
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setStock(0)}
              className="flex-1 min-h-[44px] rounded-[11px] bg-cream border-[1.5px] border-line text-xs font-semibold text-ink-soft hover:border-pink hover:text-pink-deep transition-colors disabled:opacity-60"
            >
              Habiskan
            </button>
          </div>
          {fieldError("stock") && <p className="text-sm text-hot">{fieldError("stock")}</p>}
        </div>

        {categories.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-category" className="text-sm font-medium text-ink">
              Kategori
            </label>
            <select
              id="product-category"
              value={categoryId}
              disabled={isSaving}
              onChange={(event) => setCategoryId(event.target.value)}
              className="bg-white border-[1.5px] border-line rounded-[14px] min-h-[50px] px-4 text-ink text-[16px] focus:border-pink"
            >
              <option value="">Tanpa kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {fieldError("categoryId") && (
              <p className="text-sm text-hot">{fieldError("categoryId")}</p>
            )}
          </div>
        )}

        <Segmented<PrepType>
          label="Perlu diracik di tempat?"
          value={prepType}
          disabled={isSaving}
          onChange={setPrepType}
          options={[
            { value: "NEEDS_PREP", label: "Perlu diracik" },
            { value: "READY_TO_SERVE", label: "Siap ambil" },
          ]}
        />

        <Segmented<boolean>
          label="Tampilkan di katalog?"
          value={isActive}
          disabled={isSaving}
          onChange={setIsActive}
          options={[
            { value: true, label: "Tampilkan" },
            { value: false, label: "Sembunyikan" },
          ]}
        />

        <div className="flex flex-col gap-2 pt-1">
          <Button type="submit" variant="primary" fullWidth isLoading={isSaving}>
            {isEditing ? "Simpan perubahan" : "Tambah menu"}
          </Button>
          <Button type="button" variant="flat" fullWidth onClick={onClose} disabled={isSaving}>
            Batal
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
