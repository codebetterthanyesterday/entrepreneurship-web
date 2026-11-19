import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getAllProducts } from "@/lib/queries/product.query";
import { STOCK_REASON_LABEL, getStockHistory } from "@/lib/queries/stock-history.query";
import { pageTitle } from "@/lib/brand";
import { PageHead } from "@/components/staff/page-head";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: pageTitle("Riwayat stok"),
};

// Stock moves with every sale; nothing here may be prerendered.
export const dynamic = "force-dynamic";

/** "20 Sep 2026, 13.45" in the event's timezone, wherever the reader is. */
const TIMESTAMP = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const href = (menu: string | null, page: number) => {
  const params = new URLSearchParams();
  if (menu) params.set("menu", menu);
  if (page > 1) params.set("halaman", String(page));
  const query = params.toString();
  return query ? `/admin/menu/riwayat?${query}` : "/admin/menu/riwayat";
};

/**
 * Admin → Menu & stok → Riwayat stok: every change to the stock, newest
 * first, with why it moved (a sale, a cancellation, an admin's correction),
 * who moved it and for which order. Narrowed to one menu item with `?menu=`;
 * the filter is a plain form, so it works before anything has hydrated.
 */
export default async function StockHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const menu = typeof params.menu === "string" && params.menu !== "" ? params.menu : null;
  const requested = typeof params.halaman === "string" ? Number.parseInt(params.halaman, 10) : 1;

  const [products, history] = await Promise.all([
    getAllProducts(),
    getStockHistory({ productId: menu, page: Number.isNaN(requested) ? 1 : requested }),
  ]);
  const selected = menu ? products.find((product) => product.id === menu) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/admin/menu" className="mb-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-ink-soft hover:text-ink">
          ← Menu & stok
        </Link>
        <PageHead
          className="mb-0"
          tag="Stock ledger"
          title="Riwayat stok"
          lede="Setiap perubahan stok: terjual, pesanan batal, dan koreksi admin, terbaru di atas"
        />
      </div>

      <form method="get" className="s-slab flex flex-wrap items-end gap-3 p-3.5">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Menu</span>
          <select
            name="menu"
            defaultValue={menu ?? ""}
            className="ui-field min-h-[46px] rounded-[12px] border-[1.5px] border-line bg-white px-3 text-[15px] text-ink"
          >
            <option value="">Semua menu</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="flat" size="sm" className="px-5">
          Tampilkan
        </Button>
      </form>

      <p role="status" className="text-sm text-ink-soft">
        {history.total} perubahan
        {selected && (
          <>
            {" "}
            untuk {selected.name} · stok sekarang <b className="text-ink tabular-nums">{selected.stock}</b>
          </>
        )}
      </p>

      {history.rows.length === 0 ? (
        <p className="s-slab p-4 text-sm text-ink-soft">Belum ada perubahan stok di sini.</p>
      ) : (
        <ol className="flex flex-col gap-2" aria-label="Riwayat stok">
          {history.rows.map((row) => (
            <li key={row.id} className="s-slab flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                {!selected && <p className="truncate text-[14px] font-extrabold text-ink">{row.productName}</p>}
                <p className="text-[13px] font-semibold text-ink">
                  {STOCK_REASON_LABEL[row.reason] ?? row.reason}
                  {row.orderNumber && <span className="font-mono font-normal text-ink-soft"> · {row.orderNumber}</span>}
                </p>
                <p className="text-[12px] text-ink-soft">
                  {TIMESTAMP.format(new Date(row.at))}
                  {row.actorName ? ` · ${row.actorName}` : row.reason === "ORDER_CONFIRMED" ? " · checkout pelanggan" : ""}
                </p>
              </div>
              <span
                className={cn(
                  "flex-none text-[18px] font-extrabold tabular-nums",
                  row.quantity > 0 ? "text-ok" : "text-hot",
                )}
                aria-label={`${row.quantity > 0 ? "Tambah" : "Kurang"} ${Math.abs(row.quantity)}`}
              >
                {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
              </span>
            </li>
          ))}
        </ol>
      )}

      {history.pageCount > 1 && (
        <nav aria-label="Halaman riwayat" className="flex items-center justify-between gap-3 pt-1">
          <PageLink href={href(menu, history.page - 1)} disabled={history.page === 1}>
            ← Sebelumnya
          </PageLink>
          <span className="s-eyebrow tabular-nums">
            Halaman {history.page} dari {history.pageCount}
          </span>
          <PageLink href={href(menu, history.page + 1)} disabled={history.page === history.pageCount}>
            Berikutnya →
          </PageLink>
        </nav>
      )}
    </div>
  );
}

/** At either end, plain text rather than a dead link. */
function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  const shared = "ui-btn inline-flex items-center min-h-[44px] px-4 text-sm";
  if (disabled) {
    return <span className={cn(shared, "bg-sand text-ink-soft opacity-60 shadow-none")}>{children}</span>;
  }
  return (
    <Link href={href} className={cn(shared, "bg-white text-ink hover:bg-pink-soft")}>
      {children}
    </Link>
  );
}
