import * as React from "react";

interface ExportOption {
  type: string;
  label: string;
  description: string;
}

const EXPORT_OPTIONS: readonly ExportOption[] = [
  {
    type: "orders",
    label: "Daftar pesanan",
    description: "Satu baris per pesanan: nomor, kanal, status, pelanggan, bayar, dan total",
  },
  {
    type: "items",
    label: "Rincian item",
    description: "Satu baris per menu yang dipesan, lengkap dengan harga saat pesan",
  },
  {
    type: "products",
    label: "Rekap per menu",
    description: "Berapa porsi tiap menu terjual, sisa stoknya, dan pemasukannya",
  },
];

/**
 * The three report attachments, as plain download links.
 *
 * Anchors rather than buttons with a fetch: a CSV download is exactly what an
 * `<a download>` is for, the browser handles the save dialog and the filename
 * from `Content-Disposition`, and nothing here needs to run in JavaScript. The
 * endpoint checks the admin's role itself, so a link that someone copies out of
 * the page is no use to anyone else.
 */
export function ExportPanel() {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
          Ekspor data
        </h2>
        <p className="text-sm text-ink-soft">
          Unduh sebagai CSV, siap dibuka di Excel atau Google Sheets buat lampiran laporan
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {EXPORT_OPTIONS.map((option) => (
          <a
            key={option.type}
            href={`/api/admin/export?type=${option.type}`}
            download
            className="flex items-center justify-between gap-3 bg-white border-[1.5px] border-line rounded-[18px] p-3.5 min-h-[44px] transition-colors hover:border-pink focus:border-pink"
          >
            <span className="min-w-0">
              <span className="block font-semibold text-sm text-ink">{option.label}</span>
              <span className="block text-xs font-medium text-ink-soft">
                {option.description}
              </span>
            </span>

            <span
              aria-hidden="true"
              className="flex-none text-[11px] font-semibold text-pink-deep uppercase tracking-wider"
            >
              Unduh
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
