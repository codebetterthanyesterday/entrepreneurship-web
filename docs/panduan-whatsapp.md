# Panduan WhatsApp Tim

Cara menyiapkan dan memakai nomor WhatsApp tim untuk web Bunnyè. Ditulis 19 November 2026, setelah fitur chat pengunjung (PR #10) dan chat pelanggan dari kasir & admin (PR #11) live.

## Ringkasan

| # | Pekerjaan | Sifat | Perkiraan waktu |
|---|-----------|-------|-----------------|
| 1 | Menyiapkan satu nomor tim | Wajib, sekali | 10 menit |
| 2 | Menautkan WhatsApp ke perangkat kasir | Wajib, per perangkat | 3 menit |
| 3 | Mengisi nomor dan jam balas di admin | Wajib, sekali | 2 menit |
| 4 | Mencoba alurnya | Wajib, sekali | 5 menit |
| 5 | Pindah ke WhatsApp Business | Opsional | 15 menit |

Web ini memakai **link chat** (`wa.me`): tombol chat membuka WhatsApp di HP atau laptop orang yang menekannya, ke nomor tujuan, dengan pesan yang sudah terketik. Tidak ada API, tidak ada biaya, dan tidak ada yang terkirim otomatis. Pesan baru terkirim kalau orangnya sendiri menekan kirim di WhatsApp.

Akibatnya, aturan terpenting di panduan ini:

> **Pesan dari tim terkirim dari akun WhatsApp yang sedang login di perangkat itu.** Kalau kasir menekan "Chat pelanggan" di HP yang login WhatsApp pribadinya, pelanggan menerima pesan dari nomor pribadi kasir, bukan nomor tim.

Nama menu di aplikasi WhatsApp sesekali berubah. Kalau ada yang tidak persis sama dengan panduan ini, cari yang paling mirip di bagian yang sama.

---

## 1. Menyiapkan satu nomor tim

Satu nomor untuk semua lokasi (Market Day, Kampus B, Kampus C, Lainnya). Semua tombol chat di web mengarah ke nomor ini.

1. Siapkan satu kartu SIM khusus tim. Jangan memakai nomor pribadi anggota tim: kalau orangnya keluar atau HP-nya hilang, semua riwayat chat pelanggan ikut pergi.
2. Pasang kartu itu di satu HP yang disimpan tim (kita sebut **HP tim**).
3. Pasang aplikasi **WhatsApp** biasa, lalu daftarkan dengan nomor itu.
4. Isi profil:
   - **Nama:** Bunnyè (sama dengan nama toko di web, supaya pelanggan yakin chatnya benar).
   - **Foto:** logo Bunnyè.
   - **Info/About:** misalnya "Balas jam 08.00–21.00 WIB".
5. Aktifkan cadangan chat: **Setelan → Chat → Cadangan chat**, ke Google Drive (Android) atau iCloud (iPhone), dengan akun milik tim.

### Kenapa WhatsApp biasa cukup

Link `wa.me` bekerja sama persis untuk WhatsApp biasa dan WhatsApp Business. Web tidak perlu tahu jenisnya. WhatsApp Business baru berguna kalau tim mau balasan otomatis di luar jam, label, atau balasan cepat (lihat bagian 5).

### Jangan lakukan

- Jangan mendaftarkan nomor tim di dua HP sebagai akun utama. WhatsApp hanya mengizinkan satu HP utama per nomor; HP lain harus **ditautkan** (bagian 2), bukan didaftarkan ulang. Mendaftar ulang di HP lain akan mengeluarkan HP pertama.
- Jangan membiarkan HP tim mati terlalu lama. Perangkat tertaut ikut keluar kalau HP utama tidak tersambung internet sekitar 14 hari.

---

## 2. Menautkan WhatsApp ke perangkat kasir

Setiap perangkat yang dipakai untuk membuka halaman **Kasir → Preorder** atau **Admin → Pesanan** harus login ke nomor tim. WhatsApp mengizinkan sampai 4 perangkat tertaut selain HP tim.

### 2.1 Laptop atau komputer

1. Di laptop, pasang **WhatsApp Desktop** (dari situs resmi WhatsApp atau Microsoft Store / Mac App Store), atau buka <https://web.whatsapp.com>.
2. Di HP tim, buka WhatsApp → **Perangkat tertaut** (Android: menu titik tiga; iPhone: **Setelan**) → **Tautkan perangkat**.
3. Pindai kode QR yang muncul di laptop.

Dengan **WhatsApp Desktop** terpasang, tombol chat di web langsung membuka aplikasinya. Dengan WhatsApp Web saja, browser lebih dulu menampilkan halaman WhatsApp; pilih **Lanjutkan ke chat**, lalu **gunakan WhatsApp Web**.

### 2.2 Tablet atau HP kasir lain

1. Pasang WhatsApp di perangkat itu, tapi **jangan** daftar dengan nomor.
2. Di layar awal, pilih opsi untuk menautkan ke akun yang sudah ada (biasanya **Tautkan ke akun yang ada** / **Link to existing account**). Perangkat menampilkan kode QR.
3. Pindai dari HP tim lewat **Perangkat tertaut → Tautkan perangkat**.

### 2.3 Kalau kasir memakai HP pribadinya

HP pribadi yang sudah login WhatsApp pribadi akan membuka chat dari nomor pribadi. Pilihannya, dari yang paling aman:

1. Pakai perangkat milik tim saja untuk melayani preorder.
2. Pasang **WhatsApp Business** di HP pribadi itu dan tautkan ke nomor tim, **hanya kalau nomor tim sudah memakai WhatsApp Business** (bagian 5). WhatsApp biasa dan WhatsApp Business bisa berdampingan di satu HP dengan nomor berbeda. Saat menekan tombol chat, HP menanyakan aplikasi mana yang dipakai: pilih **WhatsApp Business**.
3. Di HP Android yang mendukung, tambahkan nomor tim sebagai akun kedua di WhatsApp yang sama, lalu **pindah ke akun tim sebelum** menekan tombol chat di web.

Apa pun pilihannya, sebelum mengirim, lihat sekilas nama akun di bagian atas WhatsApp. Kalau bukan akun tim, tutup tanpa mengirim.

### Saat ada anggota tim yang keluar

Buka **Perangkat tertaut** di HP tim, ketuk perangkat orang itu, lalu **Keluar**. Daftarnya juga menunjukkan kapan tiap perangkat terakhir aktif; keluarkan yang tidak dikenal.

---

## 3. Mengisi nomor dan jam balas di admin

1. Login sebagai admin, buka **Admin → Pengaturan**, gulir ke bagian **Lain-lain**.
2. Isi **Nomor WhatsApp tim**. Semua bentuk ini diterima: `081234567890`, `0812-3456-7890`, `+62 812 3456 7890`, `6281234567890`.
3. Atur **Jam balas chat (WIB)**: **Mulai** dan **Selesai**. Bawaannya 08.00–21.00. Jam selesai harus setelah jam mulai.
4. Klik **Simpan**. Muncul "Pengaturannya udah disimpan!".

### Apa pengaruh jam balas

Jam balas hanya **memberi tahu** pengunjung. Di luar jam itu tombol chat tetap ada dan tetap bisa dipakai, tapi di bawahnya tertulis "Lagi di luar jam balas. Chat aja, kami balas mulai 08.00 WIB." Di dalam jam itu tertulis "Dibalas jam 08.00–21.00 WIB." Jadi, isi jam yang benar-benar ada orang yang membalas.

### Cara memastikan

- Kalau nomornya tidak bisa dipakai, di bawah kolom muncul peringatan "Belum ada nomor yang bisa dipakai, jadi tombol chat WhatsApp di web pengunjung disembunyikan dulu." Periksa lagi nomornya.
- Buka <https://bunnye.vercel.app>. Di kepala halaman ada tombol hijau **Tanya**.

### Kalau nomor tim ganti

Ganti nomornya di sini; semua tombol langsung memakai nomor baru. Pelanggan yang menyimpan chat lama tetap akan menulis ke nomor lama, jadi biarkan nomor lama aktif beberapa minggu dan pasang pesan yang menunjuk ke nomor baru.

---

## 4. Mencoba alurnya

Coba dari **HP pribadi**, bukan HP tim (WhatsApp tidak bisa chat ke nomornya sendiri). Jangan membuat pesanan baru di web production hanya untuk mencoba.

### 4.1 Sisi pengunjung

1. Di HP pribadi, buka <https://bunnye.vercel.app> dan ketuk **Tanya**.
2. WhatsApp terbuka ke nomor tim, dengan pesan "Halo Bunnyè! Aku mau tanya dulu: " sudah terketik.
3. Kirim, lalu pastikan pesannya masuk di HP tim dan di laptop kasir yang tertaut.

### 4.2 Sisi tim

1. Di laptop kasir, buka **Kasir → Preorder**, lalu ketuk salah satu pesanan.
2. Di sheet pesanan ada bagian **Chat pelanggan** dengan beberapa tombol template.
3. Ketuk **Chat tanpa template**. WhatsApp terbuka ke nomor pelanggan itu.
4. Pastikan nama akun di WhatsApp adalah akun **tim**. Lalu **tutup tanpa mengirim**: itu pelanggan sungguhan.

---

## 5. Opsional: pindah ke WhatsApp Business

Pindah ke WhatsApp Business tidak mengubah apa pun di web: nomornya sama, tidak ada pengaturan yang perlu diganti.

### Kapan layak

- Tim ingin **pesan di luar jam** terkirim otomatis.
- Tim ingin **label** untuk menandai chat, misalnya "Lainnya: cek lokasi", "Belum bayar", "Selesai".
- Tim sering mengetik balasan yang sama dan ingin **balasan cepat**.
- Kasir perlu memakai HP pribadinya (bagian 2.3, pilihan 2).

### Cara pindah dengan nomor yang sama

1. Di HP tim, buat cadangan chat dulu (bagian 1, langkah 5).
2. Pasang **WhatsApp Business**, buka, dan masukkan nomor tim. Aplikasi menawarkan memindahkan akun dan riwayat chat dari WhatsApp biasa; setujui.
3. Setelah selesai, WhatsApp biasa di HP tim tidak lagi memakai nomor itu.
4. Tautkan ulang semua perangkat kasir (bagian 2), karena tautan lama ikut terputus.

Anggap perpindahan ini satu arah: kembali ke WhatsApp biasa memungkinkan, tapi lebih repot dan riwayat chat tidak selalu ikut.

### Yang perlu diatur

Semua ada di **Setelan → Alat bisnis** (Business tools):

| Fitur | Isi yang disarankan |
|-------|---------------------|
| **Profil bisnis** | Kategori makanan & minuman; jam buka sama dengan **Jam balas chat** di admin; link `https://bunnye.vercel.app` |
| **Pesan di luar jam** (Away message) | Jadwal **di luar jam kerja**, dengan jam yang sama persis dengan **Jam balas chat** di admin. Contoh: "Makasih udah chat Bunnyè! Kami lagi di luar jam balas, besok mulai 08.00 WIB langsung kami bales ya." |
| **Pesan sambutan** (Greeting) | Opsional. Pesan dari web sudah menyebut nomor pesanan, jadi sambutan cukup singkat atau dimatikan. |
| **Balasan cepat** (Quick replies) | Jawaban yang sering diketik, misalnya cara bayar QRIS atau patokan Market Day. Pesan yang terkait pesanan sudah disediakan sebagai template di **Chat pelanggan**, tidak perlu dibuat ulang. |
| **Label** | Satu label per hal yang perlu ditindaklanjuti. |

Kalau **Jam balas chat** di admin diubah, ubah juga jadwal pesan di luar jam dan jam buka di profil bisnis, supaya web dan WhatsApp mengatakan hal yang sama.

---

## Pemakaian sehari-hari

### Pesan yang masuk dari pengunjung

Semua pesan dari web sudah membawa konteksnya, jadi tim tidak perlu bertanya "pesanan yang mana?".

| Tombol di web | Muncul di | Isi pesan |
|---------------|-----------|-----------|
| **Tanya** | Kepala semua halaman | Pertanyaan umum sebelum memesan |
| **Chat soal pesanan ini** | Halaman pesanan | Nomor pesanan dan jadwal |
| **Kirim patokan lokasi** | Halaman pesanan Lainnya yang lokasinya masih dicek | Nomor pesanan, jadwal, dan patokan lokasi |
| **Chat soal pembatalan** | Halaman pesanan yang dibatalkan | Nomor pesanan dan permintaan dicek |
| **Lama belum Lunas? Chat kami** | Setelah bukti QRIS terkirim | Nomor pesanan dan total |
| **Lupa nomor pesanannya? Tanya kami** | Halaman **Lacak pesanan** | Nama dan tanggal pesanan, untuk diisi pelanggan |
| **Laporkan ke kami** | Halaman yang gagal dimuat | Alamat halaman dan kode error |

Cari pesanannya di **Kasir → Preorder** dengan nomor pesanan dari chat.

Untuk "Laporkan ke kami", teruskan kode error-nya ke pengelola web: kode itu dipakai untuk menemukan masalahnya di log.

### Mengirim pesan ke pelanggan

Di sheet pesanan (**Kasir → Preorder** atau **Admin → Pesanan**), bagian **Chat pelanggan** menawarkan template sesuai kondisi pesanan. Template yang paling mungkin dipakai ada di paling atas dan berwarna hijau.

| Template | Kapan muncul |
|----------|--------------|
| **Minta patokan lokasi** | Lokasi Lainnya masih dicek |
| **Kabari: lokasi diterima** | Lokasi Lainnya diterima. Membawa jadwal, plus link bayar kalau QRIS belum dibayar. |
| **Kabari: lokasi ditolak, tawarkan lokasi lain** | Lokasi Lainnya ditolak. Mengajak pesan lagi di Kampus B, Kampus C, atau Market Day, dan menanyakan e-wallet atau rekening untuk pengembalian kalau sudah bayar. |
| **Ingatkan bayar QRIS** | QRIS belum dibayar dan belum ada bukti |
| **Pesanan siap diambil** | Market Day |
| **Pesanan lagi diantar** | Kampus B, Kampus C, Lainnya |
| **Ada kendala atau jadwal mundur** | Pesanan masih berjalan. Pesannya berhenti di "ada kendala: ", lanjutkan sendiri. |
| **Chat tanpa template** | Selalu ada |

Template hanya mengisi pesan. Periksa, ubah kalau perlu, lalu kirim sendiri di WhatsApp.

Kalau bagian ini menampilkan "Pesanan ini nggak punya nomor WhatsApp pelanggan." atau "Nomor WhatsApp pelanggan (…) nggak bisa dipakai buat chat.", hubungi pelanggan lewat cara lain.

### Pesanan Lainnya: cek, putuskan, kabari

1. Pesanan Lainnya masuk dengan status lokasi masih dicek. Di **Kasir → Preorder**, chip **Lokasi Lainnya (n)** menyaring pesanan seperti ini.
2. Kalau patokannya kurang jelas, kirim **Minta patokan lokasi**.
3. Terima atau tolak lokasinya. Sheet tetap terbuka setelahnya.
4. Kirim template **Kabari: lokasi diterima** atau **Kabari: lokasi ditolak**. Menekan template itu otomatis menandai pelanggan sudah dikabari.
5. Kalau pelanggan dikabari lewat cara lain (telepon, ketemu langsung), tekan **Udah dikabari**.

Sampai langkah 4 atau 5 dilakukan, pesanannya bertanda **belum dikabari** di daftar kasir dan di kartu pesanan admin, dan tetap dihitung di chip **Lokasi Lainnya**. Tandanya hilang sendiri setelah tanggal serah terimanya lewat.

Tanda "sudah dikabari" tercatat begitu WhatsApp dibuka dari template, bukan saat pesannya benar-benar terkirim. Kalau batal mengirim, kirim ulang dari sheet yang sama.

---

## Kalau ada masalah

| Gejala | Penyebab | Yang dilakukan |
|--------|----------|----------------|
| Tombol **Tanya** tidak ada di web | Nomor tim kosong atau tidak valid | Bagian 3; perhatikan peringatan di bawah kolom nomor |
| Pesan ke pelanggan terkirim dari nomor pribadi | Perangkat itu login WhatsApp pribadi | Bagian 2.3. Kirim pesan susulan dari nomor tim supaya pelanggan tahu nomor yang benar |
| Di laptop muncul halaman WhatsApp, bukan chat | WhatsApp Desktop belum terpasang | Pilih **Lanjutkan ke chat** → **gunakan WhatsApp Web**, atau pasang WhatsApp Desktop |
| Laptop kasir tiba-tiba minta pindai QR lagi | HP tim lama tidak tersambung, atau perangkat dikeluarkan | Nyalakan HP tim, tautkan ulang (bagian 2) |
| Pesanan Lainnya masih bertanda **belum dikabari** padahal sudah dichat | Pelanggan dikabari tanpa lewat template | Tekan **Udah dikabari** di sheet pesanannya |
| Pengunjung bilang chatnya tidak dibalas | Pesan masuk di luar jam, atau tidak ada yang memegang HP/laptop tim | Atur ulang **Jam balas chat**; dengan WhatsApp Business, pasang pesan di luar jam |

## Privasi

- Pesan dari web tidak pernah membawa nomor HP pelanggan, bukti bayar, atau data pribadi lain; isinya hanya nomor pesanan, jadwal, dan total.
- Jangan meminta pelanggan mengirim ulang bukti bayar lewat WhatsApp kalau buktinya sudah terunggah di web; kasir bisa melihatnya di sheet pesanan.
- Riwayat chat tim berisi data pelanggan. Simpan cadangan hanya di akun milik tim, dan keluarkan perangkat anggota yang sudah tidak bertugas.
