import * as React from "react";
import { pageTitle } from "@/lib/brand";
import { getSiteIdentity } from "@/lib/queries/site.query";
import { ChatLink } from "@/components/public/whatsapp-chat";

export const metadata = {
  title: pageTitle("Privasi"),
  description: "Data apa yang kami simpan waktu kamu pesan atau foto di booth, buat apa, dan cara memintanya dihapus.",
};

/**
 * What happens to a customer's personal data, as Indonesia's personal data
 * protection law (UU PDP, No. 27/2022) asks a business to say: what is kept,
 * why, who sees it, where, for how long, and how to have it corrected or
 * deleted. Linked from the checkout, right before the order is sent, and
 * from the footer.
 *
 * Every line describes what the system does today. Photos are deleted when
 * the booth's retention passes; order data has no automatic deletion, so the
 * page says so instead of promising one.
 */
export default async function PrivacyPage() {
  const { brandName } = await getSiteIdentity();

  return (
    <>
      <section className="pt-4 tablet:pt-6">
        <div className="band-inner stage-enter">
          <div className="k-panel p-4 tablet:p-7">
            <p className="k-tag k-tag-yellow">Privasi</p>
            <h1 className="k-page-title mt-3 text-ink">Data kamu di {brandName}</h1>
            <p className="journey-lede mt-2 text-ink-soft">
              Apa yang kami simpan waktu kamu pesan atau foto di booth, buat apa, dan gimana kalau mau
              dihapus.
            </p>
          </div>
        </div>
      </section>

      <section className="band-tight menu-counter">
        <div className="band-inner-narrow flex flex-col gap-8 text-[14.5px] leading-relaxed text-ink">
          <Part title="Yang kami simpan">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <b>Waktu kamu pesan:</b> nama, nomor WhatsApp, tanggal dan lokasi serah terima (beserta
                patokan lokasi kalau kamu isi), catatan pesanan, menu yang dipesan, dan cara bayar.
              </li>
              <li>
                <b>Kalau bayar pakai QRIS:</b> gambar bukti bayar yang kamu unggah. Pembayarannya sendiri
                terjadi di aplikasi e-wallet atau bank kamu; kami cuma melihat yang tertera di bukti itu.
              </li>
              <li>
                <b>Di booth foto:</b> foto-foto dari sesimu.
              </li>
            </ul>
            <p className="mt-2 text-ink-soft">
              Kami nggak minta email, kata sandi, atau data kartu, dan nggak pakai cookie iklan.
            </p>
          </Part>

          <Part title="Buat apa">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Menyiapkan, mengantar, atau menyerahkan pesananmu.</li>
              <li>Menghubungi kamu lewat WhatsApp soal pesanan itu: jadwal, lokasi, pembayaran, atau kendala.</li>
              <li>Mengecek pembayaran QRIS.</li>
              <li>Membuka foto booth kamu dengan nomor pesanan dan 4 digit terakhir WhatsApp.</li>
              <li>Catatan penjualan internal tim.</li>
            </ul>
            <p className="mt-2 font-semibold">
              Datamu nggak dijual, nggak dibagikan ke pihak lain, dan nggak dipakai buat promosi atau
              broadcast.
            </p>
          </Part>

          <Part title="Siapa yang bisa melihat">
            <p>
              Tim {brandName} yang bertugas (kasir, dapur, admin, dan kru foto), masing-masing lewat
              akunnya sendiri. Halaman pesanan hanya terbuka untuk yang tahu nomor pesananmu, dan halaman
              Lacak juga meminta 4 digit terakhir WhatsApp-mu.
            </p>
            <p className="mt-2">
              Papan foto publik di booth hanya menampilkan versi berstempel, dan kamu bisa mematikannya
              kapan saja dari halaman fotomu.
            </p>
          </Part>

          <Part title="Di mana disimpan">
            <p>
              Di layanan cloud Supabase (data pesanan dan foto) dan Vercel (server web), dengan server di
              Mumbai, India. Semua koneksi ke web ini terenkripsi (HTTPS), dan foto hanya bisa dibuka lewat
              tautan yang kedaluwarsa sendiri.
            </p>
          </Part>

          <Part title="Berapa lama">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <b>Foto booth</b> dihapus otomatis setelah masa simpan booth lewat. Kamu juga bisa
                menghapusnya sendiri lebih cepat dari halaman fotomu.
              </li>
              <li>
                <b>Data pesanan</b> disimpan sebagai catatan penjualan. Kalau mau dihapus lebih cepat, chat
                kami.
              </li>
            </ul>
          </Part>

          <Part title="Hak kamu">
            <p>
              Sesuai Undang-Undang Pelindungan Data Pribadi (UU No. 27 Tahun 2022), kamu boleh minta
              melihat, membetulkan, atau menghapus data pesananmu, dan menarik izin tampil di papan foto.
              Chat kami di WhatsApp dengan nomor pesananmu; kami bantu secepatnya.
            </p>
            <ChatLink intent={{ kind: "general" }} className="mt-4 w-full tablet:w-auto">
              Chat soal data saya
            </ChatLink>
          </Part>

          <p className="text-[12.5px] text-ink-soft">Terakhir diperbarui 19 November 2026.</p>
        </div>
      </section>
    </>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="k-section-title !text-[clamp(19px,5vw,26px)]">{title}</h2>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}
