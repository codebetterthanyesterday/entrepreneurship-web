"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/ui/chip";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/use-toast";
import { createProductAction, updateProductAction } from "@/actions/product.actions";
import { ProductCard } from "./product-card";
import { ProductFormSheet, type ProductFormValues } from "./product-form-sheet";
import type { AdminCategory, AdminProduct } from "@/types/admin";
import { PageHead } from "@/components/staff/page-head";

const ALL_FILTER = "Semua";
const LOW_STOCK_FILTER = "Hampir habis";

export interface MenuManagerProps {
  products: AdminProduct[];
  categories: AdminCategory[];
  lowStockThreshold: number;
}

export function MenuManager({ products, categories, lowStockThreshold }: MenuManagerProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [filter, setFilter] = React.useState<string>(ALL_FILTER);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminProduct | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<{ message: string; field?: string } | null>(null);

  const filters = [ALL_FILTER, ...categories.map((category) => category.name), LOW_STOCK_FILTER];

  const visibleProducts = products.filter((product) => {
    if (filter === ALL_FILTER) return true;
    if (filter === LOW_STOCK_FILTER) return product.stock <= lowStockThreshold;
    return product.categoryName === filter;
  });

  const openSheet = (product: AdminProduct | null) => {
    setEditing(product);
    setError(null);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    if (isSaving) return;
    setSheetOpen(false);
    setError(null);
  };

  const handleSubmit = async (values: ProductFormValues) => {
    setIsSaving(true);
    setError(null);

    const result = editing
      ? await updateProductAction(editing.id, values)
      : await createProductAction({
          ...values,
          // createProductSchema takes an optional categoryId, never null.
          categoryId: values.categoryId ?? undefined,
        });

    setIsSaving(false);

    if (!result.ok) {
      setError({ message: result.error, field: result.field });
      return;
    }

    setSheetOpen(false);
    toast(editing ? "Menunya udah diperbarui!" : "Menu barunya udah masuk katalog!");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        className="mb-0"
        tag="Item inventory"
        title="Menu & stok"
        lede="Ketuk menu buat ubah stok, harga, atau sembunyikan dari katalog"
        actions={
          <div className="flex flex-none gap-2">
            <ButtonLink href="/admin/menu/kategori" size="sm" variant="flat" className="flex-none">
              Kategori
            </ButtonLink>
            <Button size="sm" variant="primary" onClick={() => openSheet(null)} className="flex-none">
              + Menu
            </Button>
          </div>
        }
      />

      <div className="flex gap-2 overflow-x-auto pt-1 pb-2.5 -mx-3.5 px-3.5 [scrollbar-width:none] tablet:mx-0 tablet:px-0 tablet:flex-wrap">
        {filters.map((name) => (
          <Chip
            key={name}
            active={filter === name}
            aria-pressed={filter === name}
            onClick={() => setFilter(name)}
            className="flex-none"
          >
            {name}
          </Chip>
        ))}
      </div>

      {visibleProducts.length === 0 ? (
        <EmptyState
          emoji="🍽️"
          title="Nggak ada menu di sini"
          description={
            filter === ALL_FILTER
              ? "Katalognya masih kosong. Yuk tambah menu pertama kamu!"
              : "Coba pilih filter lain, atau tambah menu baru ke kategori ini."
          }
          action={
            <Button variant="primary" size="sm" onClick={() => openSheet(null)}>
              + Menu
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3.5">
          {visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              lowStockThreshold={lowStockThreshold}
              onSelect={openSheet}
            />
          ))}
        </div>
      )}

      {sheetOpen && (
        <ProductFormSheet
          open
          product={editing}
          images={editing ? products.find((product) => product.id === editing.id)?.images : undefined}
          categories={categories}
          isSaving={isSaving}
          error={error}
          onClose={closeSheet}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
