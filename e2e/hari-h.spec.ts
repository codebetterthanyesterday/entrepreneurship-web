import { expect, test, type Browser, type Page } from "@playwright/test";
import { E2E_BASE_URL, E2E_LOGIN_PATH, MENU, STAFF } from "./constants";

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
  await page.context().addCookies([{ name: "bunnye_splash", value: "1", url: E2E_BASE_URL }]);
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
