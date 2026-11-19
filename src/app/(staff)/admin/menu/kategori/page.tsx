import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listCategoriesWithCounts } from "@/lib/services/category.service";
import { CategoryManager } from "@/components/admin/category-manager";
import { pageTitle } from "@/lib/brand";
import { PageHead } from "@/components/staff/page-head";

export const metadata = {
  title: pageTitle("Kategori menu"),
};

// Categories change from this very screen; nothing here may be prerendered.
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requireRole("ADMIN");
  const categories = await listCategoriesWithCounts();

  return (
    <div>
      <Link href="/admin/menu" className="mb-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-ink-soft hover:text-ink">
        ← Menu & stok
      </Link>
      <PageHead
        tag="Shelf order"
        title="Kategori menu"
        lede="Urutannya jadi urutan rak di katalog dan tab di kasir. Menu tanpa kategori tampil di rak Lainnya"
      />
      <CategoryManager categories={categories} />
    </div>
  );
}
