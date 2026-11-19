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
