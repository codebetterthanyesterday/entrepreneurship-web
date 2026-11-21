import { expect, test, type Browser, type Page } from "@playwright/test";
import { E2E_BASE_URL, E2E_LOGIN_PATH, MENU, PAKET, STAFF } from "./constants";
import { RETIRED_SEEN_COOKIE, SPLASH_COOKIE } from "../src/lib/splash";

/*
 * The day as it happens, through the screens of a production build: a
 * customer preorders for Market Day, the cashier takes the money and sends it
 * to the kitchen, the kitchen makes it, the cashier hands it over, and the
 * customer's tracker says it is done. Plus what a visitor must never reach.
 *
 * The customer is the project's device; staff are phones of their own.
 */

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

/** The splash plays once per session; these tests are not about it. */
async function skipSplash(page: Page) {
  await page.context().addCookies([{ name: SPLASH_COOKIE, value: "1", url: E2E_BASE_URL }]);
}

async function signInStaff(browser: Browser, account: { email: string; password: string }) {
  const context = await browser.newContext({ ...PHONE, baseURL: E2E_BASE_URL, locale: "id-ID" });
  const page = await context.newPage();
  await skipSplash(page);
  await page.goto(E2E_LOGIN_PATH);
  await expect(page.getByRole("heading", { name: "Masuk dulu ya" })).toBeVisible();
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: /Masuk/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/masuk"));
  return page;
}

test("a preorder goes from the checkout to the customer's hands", async ({ page, browser }) => {
  const dateLabel = process.env.E2E_SERVICE_DATE_LABEL!;
  const phone = `0812${String(Date.now()).slice(-8)}`;
  await skipSplash(page);

  // The customer orders for Market Day, paying cash.
  await page.goto("/");
  await page.getByRole("button", { name: `Tambah 1 ${MENU.name} ke keranjang` }).click();
  await page.goto("/checkout");
  await page.getByLabel("Nama kamu").fill("Pelanggan E2E");
  await page.getByLabel("Nomor WhatsApp").fill(phone);
  await page.getByRole("button", { name: /^Market Day/ }).click();
  await page.getByRole("button", { name: new RegExp(dateLabel.split(", ")[1]!) }).click();
  await page.getByRole("button", { name: /^10\.00 - 11\.00/ }).click();
  await page.getByRole("button", { name: "Tunai pas ambil" }).click();
  await page.getByRole("button", { name: "Kirim pesanan" }).first().click();

  await page.waitForURL(/\/pesanan\//);
  const number = decodeURIComponent(page.url().split("/pesanan/")[1]!);
  expect(number).toMatch(/^PO-[23456789BCDFGHJKMNPQRSTVWXYZ]{6}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(number);

  // The cashier takes the money and sends it to the kitchen.
  const till = await signInStaff(browser, STAFF.KASIR);
  await till.goto("/kasir/preorder");
  await till.getByLabel("Cari nomor pesanan atau nama pelanggan").fill(number);
  await till.getByRole("button", { name: /Pelanggan E2E/ }).first().click();
  const sheet = till.getByRole("dialog", { name: `Pesanan ${number}` });
  await sheet.getByRole("button", { name: /^Terima pembayaran/ }).click();
  const payment = till.getByRole("dialog", { name: `Pembayaran ${number}` });
  await payment.getByRole("button", { name: "Uang pas" }).click();
  await payment.getByRole("button", { name: "Pembayaran diterima" }).click();
  await expect(till.getByText(`Pembayaran ${number} diterima`)).toBeVisible();
  await sheet.getByRole("button", { name: "Pelanggan datang, kirim ke dapur" }).click();
  await expect(till.getByText(`${number} dikirim ke dapur`)).toBeVisible();

  // The kitchen makes it.
  const kitchen = await signInStaff(browser, STAFF.DAPUR);
  await kitchen.goto("/dapur");
  const ticket = () => kitchen.locator("article:visible").filter({ hasText: number }).first();
  await ticket().getByRole("button", { name: "Mulai racik" }).click();
  const making = kitchen.getByRole("button", { name: /Lagi diracik/ });
  if (await making.isVisible()) await making.click();
  await ticket().getByRole("button", { name: "Tandai siap" }).click();

  // The cashier hands it over.
  await till.reload();
  await till.getByLabel("Cari nomor pesanan atau nama pelanggan").fill(number);
  await till.getByRole("button", { name: /Pelanggan E2E/ }).first().click();
  await sheet.getByRole("button", { name: "Serahkan sekarang" }).click();
  await expect(till.getByText(`${number} sudah diserahkan`)).toBeVisible();

  // The customer's tracker says so. This phone remembers the order from the
  // checkout, so the tracker opens on it without asking for the digits.
  await page.goto("/lacak");
  await expect(page.getByRole("heading", { name: "Selesai, makasih ya!" })).toBeVisible();
  await expect(page.getByText(number).first()).toBeVisible();

  await till.context().close();
  await kitchen.context().close();
});

test("a tap anywhere on a paket's card opens it, and two go in the cart from there", async ({ page }) => {
  await skipSplash(page);
  await page.goto("/");
  const card = page.locator("article").filter({ has: page.getByRole("heading", { name: PAKET.name }) });
  await card.scrollIntoViewIfNeeded();

  // The picture, not the name or the button: the whole card is the target.
  const visual = card.locator("img, svg").first();
  const box = (await visual.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  const sheet = page.getByRole("dialog", { name: PAKET.name });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText(PAKET.side)).toBeVisible();
  await sheet.getByRole("button", { name: "Tambah" }).click();
  await sheet.getByRole("button", { name: /Masukin keranjang/ }).click();

  await expect(page.getByText(`${PAKET.name} masuk keranjang!`)).toBeVisible();
  await expect(sheet).toBeHidden();
  await expect(card.getByRole("button", { name: `Masukin ${PAKET.name} ke keranjang` })).toContainText("· 2");
});

test("the splash opens every customer page, and covers the wait between pages", async ({ page }) => {
  // No skip cookie here: this is the one test about the splash. The cookie the
  // old once-a-session splash left on phones must not keep it away either.
  await page.context().addCookies([{ name: RETIRED_SEEN_COOKIE, value: "1", url: E2E_BASE_URL }]);
  const splash = page.locator(".k-splash").first();

  for (const path of ["/", "/lacak"]) {
    await page.goto(path);
    await expect(splash).toBeAttached();
    // It leaves by itself once the page has loaded, well within 3 s.
    await expect(splash).toBeHidden({ timeout: 3_500 });
  }

  // A slow move between pages shows the splash's loading form until the page arrives.
  await page.goto("/");
  await expect(splash).toBeHidden({ timeout: 3_500 });
  await page.route(
    (url) => url.pathname === "/keranjang",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    },
  );
  await page.getByRole("link", { name: /Keranjang/ }).first().click();
  const loading = page.getByRole("status", { name: "Lagi nyiapin halaman..." });
  await expect(loading).toBeVisible();
  await expect(page).toHaveURL(/\/keranjang$/);
  await expect(loading).toBeHidden({ timeout: 5_000 });
});

test("a visitor cannot tell the staff side is there", async ({ request }) => {
  for (const path of ["/admin", "/kasir/preorder", "/dapur", "/login"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
  expect((await request.get(E2E_LOGIN_PATH)).status()).toBe(200);
});

test("an order page for an order that does not exist is a real 404", async ({ request }) => {
  expect((await request.get("/pesanan/PO-ZZZZZZ")).status()).toBe(404);
  expect((await request.get("/pesanan/bukan-nomor")).status()).toBe(404);
});

test("an admin's photos become the menu's cover and its gallery", async ({ page, browser }) => {
  const admin = await signInStaff(browser, STAFF.ADMIN);
  await admin.goto("/admin/menu");
  await admin.getByRole("button", { name: `Ubah ${MENU.name}` }).click();
  // Two real JPEGs, drawn in the browser: the server checks the bytes.
  const photos = await admin.evaluate(async () => {
    const make = async (colour: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const context = canvas.getContext("2d")!;
      context.fillStyle = colour;
      context.fillRect(0, 0, 640, 480);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.8));
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    };
    return [await make("#c08552"), await make("#5b8c5a")];
  });
  await admin.locator('input[type="file"][multiple]').setInputFiles(
    photos.map((bytes, index) => ({ name: `foto-${index + 1}.jpg`, mimeType: "image/jpeg", buffer: Buffer.from(bytes) })),
  );
  await expect(admin.getByText("2 foto udah ditambah")).toBeVisible();
  await expect(admin.getByText("Sampul")).toBeVisible();

  // A customer sees the cover on the card and both photos in the sheet.
  await skipSplash(page);
  await page.goto("/");
  const card = page.getByRole("button", { name: `Lihat ${MENU.name}` });
  await expect(card.locator("img")).toHaveAttribute("src", /^\/gambar\//);
  await card.click();
  // The mobile and desktop runs share one database, so the second run finds
  // the first run's photos too: two or more, never one.
  await expect(page.getByRole("img", { name: new RegExp(`^${MENU.name}, foto 1 dari [2-6]$`) })).toBeVisible();
  await expect(page.getByText(/^1\/[2-6]$/)).toBeVisible();

  await admin.context().close();
});

test("an admin adds a cashier, and switching them off signs them out at once", async ({ browser }) => {
  const stamp = Date.now();
  const email = `kasir-${stamp}@e2e.test`;
  // Unique per run: the mobile and desktop projects share one database.
  const name = `Kasir ${stamp}`;
  const admin = await signInStaff(browser, STAFF.ADMIN);

  // Admin → Pengaturan → Kelola akun staf → Tambah staf.
  await admin.goto("/admin/pengaturan");
  await admin.getByRole("link", { name: "Kelola akun staf" }).click();
  await admin.getByRole("button", { name: "Tambah staf" }).click();
  await admin.getByLabel("Nama").fill(name);
  await admin.getByLabel("Email").fill(email);
  await admin.getByRole("button", { name: "Kasir", exact: true }).click();
  await admin.getByRole("button", { name: "Buat akun" }).click();
  const password = (await admin.getByText(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/).innerText()).trim();
  await admin.getByRole("button", { name: "Udah dicatat, tutup" }).click();
  await expect(admin.getByRole("listitem").filter({ hasText: name }).getByText("Belum ganti password")).toBeVisible();

  // The new cashier signs in with it, and is asked to change it.
  const till = await signInStaff(browser, { email, password });
  await till.goto("/kasir/preorder");
  await expect(till.getByText(/password sementara dari admin/)).toBeVisible();

  // The admin switches the account off; the cashier's open session ends.
  await admin.getByRole("button", { name: `Ubah akun ${name}` }).click();
  await admin.getByRole("button", { name: "Nonaktif", exact: true }).click();
  await admin.getByRole("button", { name: "Simpan" }).click();
  await expect(admin.getByText(`${name} dinonaktifkan dan keluar dari semua perangkat`)).toBeVisible();

  expect((await till.goto("/kasir/preorder"))?.status()).toBe(404);

  await admin.context().close();
  await till.context().close();
});

test("an admin's new category becomes a shelf, and deleting it keeps its menu on sale", async ({ page, browser }) => {
  // Unique per run: the mobile and desktop projects share one database.
  const shelf = `Rak ${Date.now()}`;
  const admin = await signInStaff(browser, STAFF.ADMIN);

  // Admin → Menu & stok → Kategori → Tambah kategori.
  await admin.goto("/admin/menu");
  await admin.getByRole("link", { name: "Kategori" }).click();
  await admin.getByRole("button", { name: "Tambah kategori" }).click();
  await admin.getByLabel("Nama kategori").fill(shelf);
  await admin.getByRole("button", { name: "Tambah", exact: true }).click();
  await expect(admin.getByText(`Kategori ${shelf} ditambahkan`)).toBeVisible();

  // The menu goes into it.
  await admin.goto("/admin/menu");
  await admin.getByRole("button", { name: `Ubah ${MENU.name}` }).click();
  await admin.getByLabel("Kategori").selectOption({ label: shelf });
  await admin.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(admin.getByText("Menunya udah diperbarui!")).toBeVisible();

  // A customer finds it on that shelf.
  await skipSplash(page);
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: new RegExp(`— ${shelf}$`) }).getByRole("button", { name: `Lihat ${MENU.name}` }),
  ).toBeVisible();

  // The category goes; the menu stays on sale, on the "Lainnya" shelf.
  await admin.goto("/admin/menu/kategori");
  await admin.getByRole("button", { name: `Hapus ${shelf}` }).click();
  await expect(admin.getByText(/1 menu di dalamnya nggak ikut terhapus/)).toBeVisible();
  await admin.getByRole("button", { name: "Ya, hapus" }).click();
  await expect(admin.getByText(`Kategori ${shelf} dihapus; 1 menu pindah ke Tanpa kategori`)).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("region", { name: new RegExp(`— ${shelf}$`) })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: /— Lainnya$/ }).getByRole("button", { name: `Lihat ${MENU.name}` }),
  ).toBeVisible();

  await admin.context().close();
});

test("an admin deletes a menu item entered by mistake, and it leaves the catalogue", async ({ page, browser }) => {
  // Unique per run: the mobile and desktop projects share one database.
  const typo = `Kopi Salah Ketik ${Date.now()}`;
  const admin = await signInStaff(browser, STAFF.ADMIN);

  await admin.goto("/admin/menu");
  await admin.getByRole("button", { name: "+ Menu" }).first().click();
  await admin.getByLabel("Nama menu").fill(typo);
  await admin.getByLabel("Harga (Rp)").fill("15000");
  await admin.getByRole("button", { name: "Tambah menu" }).click();
  await expect(admin.getByText("Menu barunya udah masuk katalog!")).toBeVisible();

  await skipSplash(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: `Lihat ${typo}` })).toBeVisible();

  // Two taps: the first only asks to be sure.
  await admin.getByRole("button", { name: `Ubah ${typo}` }).click();
  await admin.getByRole("button", { name: "Hapus menu" }).click();
  await admin.getByRole("button", { name: "Yakin? Ketuk sekali lagi buat hapus" }).click();
  await expect(admin.getByText(`${typo} udah dihapus`)).toBeVisible();
  await expect(admin.getByRole("button", { name: `Ubah ${typo}` })).toHaveCount(0);

  await page.goto("/");
  await expect(page.getByRole("button", { name: `Lihat ${typo}` })).toHaveCount(0);

  // One that has been sold cannot go; the sheet says to hide it instead.
  await admin.getByRole("button", { name: `Ubah ${MENU.name}` }).click();
  await admin.getByRole("button", { name: "Hapus menu" }).click();
  await admin.getByRole("button", { name: "Yakin? Ketuk sekali lagi buat hapus" }).click();
  await expect(admin.getByText(/Keluarin dulu dari paketnya|Sembunyiin aja dari katalog/)).toBeVisible();
  await expect(admin.getByRole("button", { name: "Simpan perubahan" })).toBeVisible();

  await admin.context().close();
});

test("a cashier corrects a customer's name and moves their handover, and the tracker follows", async ({ page, browser }) => {
  const dateLabel = process.env.E2E_SERVICE_DATE_LABEL!;
  const phone = `0813${String(Date.now()).slice(-8)}`;
  const name = `Salah Ketik ${Date.now()}`;
  const fixed = `Nama Benar ${Date.now()}`;
  await skipSplash(page);

  // The customer orders for Market Day, with a typo in their name.
  await page.goto("/");
  await page.getByRole("button", { name: `Tambah 1 ${MENU.name} ke keranjang` }).click();
  await page.goto("/checkout");
  await page.getByLabel("Nama kamu").fill(name);
  await page.getByLabel("Nomor WhatsApp").fill(phone);
  await page.getByRole("button", { name: /^Market Day/ }).click();
  await page.getByRole("button", { name: new RegExp(dateLabel.split(", ")[1]!) }).click();
  await page.getByRole("button", { name: /^10\.00 - 11\.00/ }).click();
  await page.getByRole("button", { name: "Tunai pas ambil" }).click();
  await page.getByRole("button", { name: "Kirim pesanan" }).first().click();
  await page.waitForURL(/\/pesanan\//);
  const number = decodeURIComponent(page.url().split("/pesanan/")[1]!);

  // They ask the cashier to fix the name and bring it to Kampus B instead.
  const till = await signInStaff(browser, STAFF.KASIR);
  await till.goto("/kasir/preorder");
  await till.getByLabel("Cari nomor pesanan atau nama pelanggan").fill(number);
  await till.getByRole("button", { name: new RegExp(name) }).first().click();
  await till.getByRole("button", { name: "Ubah nama, nomor, atau jadwal" }).click();
  const edit = till.getByRole("dialog", { name: `Ubah pesanan ${number}` });
  await edit.getByLabel("Nama pelanggan").fill(fixed);
  await edit.getByRole("button", { name: /^Kampus B/ }).click();
  await edit.getByRole("button", { name: /^10\.00 - 11\.00/ }).click();
  await edit.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(till.getByText(`Data ${number} udah diperbarui`)).toBeVisible();
  const sheet = till.getByRole("dialog", { name: `Pesanan ${number}` });
  await expect(sheet.getByText(new RegExp(fixed))).toBeVisible();
  await expect(sheet.getByText(/Kampus B/)).toBeVisible();

  // The customer's tracker shows the new place.
  await page.goto("/lacak");
  await expect(page.getByText(/Kampus B/).first()).toBeVisible();

  await till.context().close();
});

test("an admin types a new paket's details key by key, and every key lands in its field", async ({ browser }) => {
  // Typed, not filled: a sheet that took focus back on every keystroke kept
  // only the first letter of each field.
  const admin = await signInStaff(browser, STAFF.ADMIN);
  await admin.goto("/admin/menu");
  await admin.getByRole("button", { name: "+ Paket" }).click();
  await expect(admin.getByRole("dialog", { name: "Paket baru" })).toBeVisible();

  const name = admin.getByLabel("Nama paket");
  await name.click();
  await name.pressSequentially("Little Power Combo");
  await expect(name).toHaveValue("Little Power Combo");
  await expect(name).toBeFocused();

  const description = admin.getByLabel("Deskripsi (opsional)");
  await description.click();
  await description.pressSequentially("Croffle dan kopi");
  await expect(description).toHaveValue("Croffle dan kopi");

  const price = admin.getByLabel("Harga paket (Rp)");
  await price.click();
  await price.pressSequentially("32000");
  await expect(price).toHaveValue(/32[.,]?000/);

  await admin.context().close();
});

test("an admin renames the store and adds its Instagram, and the customer pages follow", async ({ page, browser }) => {
  const brand = `Kedai E2E ${String(Date.now()).slice(-5)}`;
  const admin = await signInStaff(browser, STAFF.ADMIN);

  await admin.goto("/admin/pengaturan");
  const form = admin.getByRole("region", { name: "Identitas toko" });
  await form.getByLabel("Nama brand").fill(brand);
  await form.getByLabel("Tagline").fill("Kopi hangat tiap Market Day");
  await form.getByLabel("Akun Instagram").fill("https://www.instagram.com/kedai.e2e/");
  await form.getByRole("button", { name: "Simpan identitas" }).click();
  await expect(admin.getByText("Identitas tokonya udah disimpan!")).toBeVisible();

  await skipSplash(page);
  await page.goto("/");
  await expect(page.getByText(brand).first()).toBeVisible();
  await expect(page.getByText("Kopi hangat tiap Market Day").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Instagram: @kedai\.e2e/ })).toHaveAttribute(
    "href",
    "https://instagram.com/kedai.e2e",
  );

  // Emptied, every field goes back to the default, and the link goes. The
  // first save's toast has to go first, or it would pass for the second's.
  const saved = admin.getByText("Identitas tokonya udah disimpan!");
  await expect(saved).toBeHidden({ timeout: 10_000 });
  for (const label of ["Nama brand", "Tagline", "Akun Instagram"]) await form.getByLabel(label).fill("");
  await form.getByRole("button", { name: "Simpan identitas" }).click();
  await expect(saved).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(brand)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Instagram:/ })).toHaveCount(0);

  await admin.context().close();
});

test("an admin's photo becomes the paket's picture in the catalogue", async ({ page, browser }) => {
  const admin = await signInStaff(browser, STAFF.ADMIN);
  await admin.goto("/admin/menu");
  await admin.getByRole("button", { name: `Ubah ${PAKET.name}` }).click();
  const sheet = admin.getByRole("dialog", { name: "Ubah paket" });
  const photo = await admin.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#d4a373";
    context.fillRect(0, 0, 800, 600);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.8));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await sheet.locator('input[type="file"]').setInputFiles({
    name: "paket.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(photo),
  });
  // The mobile and desktop runs share one database: the second run replaces the first's.
  await expect(admin.getByText(/Foto paketnya udah (dipasang|diganti)/)).toBeVisible();
  await expect(sheet.getByRole("img", { name: `Foto paket ${PAKET.name}` })).toHaveAttribute("src", /^\/gambar\//);

  await skipSplash(page);
  await page.goto("/");
  await expect(page.locator(`img[src^="/gambar/"]`).first()).toBeVisible();
  const src = await sheet.getByRole("img", { name: `Foto paket ${PAKET.name}` }).getAttribute("src");
  await expect(page.locator(`img[src="${src}"]`).first()).toBeAttached();

  await admin.context().close();
});

test("a new menu item and a new paket get their photos in the same save", async ({ page, browser }) => {
  // Unique per run: the mobile and desktop projects share one database.
  const stamp = String(Date.now()).slice(-6);
  const menuName = `Menu Foto ${stamp}`;
  const paketName = `Paket Foto ${stamp}`;
  const admin = await signInStaff(browser, STAFF.ADMIN);
  await admin.goto("/admin/menu");
  const photos = await admin.evaluate(async () => {
    const make = async (colour: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const context = canvas.getContext("2d")!;
      context.fillStyle = colour;
      context.fillRect(0, 0, 640, 480);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.8));
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    };
    return [await make("#c08552"), await make("#5b8c5a")];
  });
  const files = photos.map((bytes, index) => ({
    name: `foto-${index + 1}.jpg`,
    mimeType: "image/jpeg",
    buffer: Buffer.from(bytes),
  }));

  // A menu item with two photos, picked before it exists.
  await admin.getByRole("button", { name: "+ Menu" }).first().click();
  const menuSheet = admin.getByRole("dialog", { name: "Menu baru" });
  await menuSheet.getByLabel("Nama menu").fill(menuName);
  await menuSheet.getByLabel("Harga (Rp)").fill("17000");
  await menuSheet.locator('input[type="file"]').setInputFiles(files);
  await expect(menuSheet.getByText("2 dari 6")).toBeVisible();
  await menuSheet.getByRole("button", { name: "Tambah menu" }).click();
  await expect(admin.getByText("Menu barunya udah masuk katalog, lengkap dengan 2 fotonya!")).toBeVisible();

  await admin.getByRole("button", { name: `Ubah ${menuName}` }).click();
  await expect(admin.getByRole("dialog", { name: "Ubah menu" }).getByText("2 dari 6")).toBeVisible();
  await admin.getByRole("button", { name: "Batal" }).click();

  // A paket with its own photo, picked before it exists.
  await admin.getByRole("button", { name: "+ Paket" }).click();
  const paketSheet = admin.getByRole("dialog", { name: "Paket baru" });
  await paketSheet.getByLabel("Nama paket").fill(paketName);
  await paketSheet.getByLabel("Menu isi ke-1").selectOption({ label: MENU.name });
  await paketSheet.getByLabel("Menu isi ke-2").selectOption({ label: menuName });
  await paketSheet.getByLabel("Harga paket (Rp)").fill("30000");
  await paketSheet.locator('input[type="file"]').setInputFiles(files[0]!);
  await expect(paketSheet.getByRole("img", { name: "Foto paket 1 yang dipilih" })).toBeVisible();
  await paketSheet.getByRole("button", { name: "Simpan paket" }).click();
  await expect(admin.getByText("Paket barunya udah masuk katalog, lengkap dengan fotonya!")).toBeVisible();

  await admin.getByRole("button", { name: `Ubah ${paketName}` }).click();
  const cover = admin.getByRole("dialog", { name: "Ubah paket" }).getByRole("img", { name: `Foto paket ${paketName}` });
  await expect(cover).toHaveAttribute("src", /^\/gambar\//);
  const src = await cover.getAttribute("src");

  // The customer sees both pictures in the catalogue.
  await skipSplash(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: `Lihat ${menuName}` }).locator("img")).toHaveAttribute("src", /^\/gambar\//);
  await expect(page.locator(`img[src="${src}"]`).first()).toBeAttached();

  await admin.context().close();
});

test("a tap anywhere on a paket's card in the admin opens it, and its switch only switches", async ({ browser }) => {
  const admin = await signInStaff(browser, STAFF.ADMIN);
  await admin.goto("/admin/menu");
  const card = admin.locator("li").filter({ has: admin.getByRole("button", { name: `Ubah ${PAKET.name}` }) });
  await card.scrollIntoViewIfNeeded();

  // Its stock line, at the bottom of the card, far from the name. Tapped by
  // position, as a finger does: the card's own button lies over the text.
  const stockLine = card.getByText(/Bisa dibikin|habis|disembunyiin/);
  // Mid-screen, clear of the bottom tab bar.
  await stockLine.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const line = (await stockLine.boundingBox())!;
  await admin.mouse.click(line.x + line.width / 2, line.y + line.height / 2);
  const sheet = admin.getByRole("dialog", { name: "Ubah paket" });
  await expect(sheet).toBeVisible();
  await admin.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // The switch hides the paket and does not open it; switched back for the others.
  const toggle = card.getByRole("switch", { name: `Tampilkan ${PAKET.name} di katalog` });
  await toggle.click();
  await expect(admin.getByText(`${PAKET.name} disembunyiin`)).toBeVisible();
  await expect(sheet).toBeHidden();
  await toggle.click();
  await expect(admin.getByText(`${PAKET.name} tampil lagi di katalog`)).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  // Drawn 32 px high, the switch answers a thumb 6 px above it too.
  const box = (await toggle.boundingBox())!;
  const hit = await admin.evaluate(
    ([x, y]) => document.elementFromPoint(x!, y!)?.getAttribute("role"),
    [box.x + box.width / 2, box.y - 6],
  );
  expect(hit).toBe("switch");

  await admin.context().close();
});

test("an admin's stock correction shows in the menu's stock history, with who made it", async ({ browser }) => {
  const admin = await signInStaff(browser, STAFF.ADMIN);
  await admin.goto("/admin/menu");
  await admin.getByRole("button", { name: `Ubah ${MENU.name}` }).click();
  await admin.getByRole("button", { name: "+5", exact: true }).click();
  await admin.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(admin.getByText("Menunya udah diperbarui!")).toBeVisible();

  await admin.getByRole("button", { name: `Ubah ${MENU.name}` }).click();
  await admin.getByRole("link", { name: "Lihat riwayat stok menu ini" }).click();
  await expect(admin.getByRole("heading", { name: "Riwayat stok" })).toBeVisible();
  await expect(admin.getByText(new RegExp(`untuk ${MENU.name} · stok sekarang`))).toBeVisible();
  const newest = admin.getByRole("list", { name: "Riwayat stok" }).getByRole("listitem").first();
  await expect(newest).toContainText("Diubah admin");
  await expect(newest).toContainText("E2E ADMIN");
  await expect(newest.getByLabel("Tambah 5")).toBeVisible();

  await admin.context().close();
});
