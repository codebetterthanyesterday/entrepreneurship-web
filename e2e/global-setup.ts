import { config as loadEnv } from "dotenv";
import bcrypt from "bcryptjs";
import { MENU, PAKET, STAFF } from "./constants";

/**
 * A known starting point for every e2e run, in DATABASE_URL_TEST: one menu
 * item that needs the kitchen, a paket of it and a second item, one date open for preorders two days ahead at
 * Market Day and Kampus B, and a cashier, a kitchen and an admin account.
 *
 * The date is passed to the tests in E2E_SERVICE_DATE_LABEL, written the way
 * the checkout labels it.
 */
export default async function globalSetup() {
  loadEnv({ path: ".env.local", quiet: true });
  // Before anything imports the database client, which reads it once; put
  // back afterwards, so the workers' config check still sees the real one.
  const developmentUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

  const { Temporal } = await import("@js-temporal/polyfill");
  const { prisma: db } = await import("@/lib/prisma");
  const { resetDatabase, makeBundle, makeProduct } = await import("@/lib/services/__tests__/helpers/test-db");
  const { openServiceDay } = await import("@/lib/services/schedule.service");
  const { formatServiceDate, todayInJakarta } = await import("@/lib/schedule");

  await resetDatabase();
  const menu = await makeProduct({ name: MENU.name, price: MENU.price, stock: 20, prepType: "NEEDS_PREP" });
  const side = await makeProduct({ name: PAKET.side, price: 10_000, stock: 20, prepType: "READY_TO_SERVE" });
  await makeBundle({
    name: PAKET.name,
    price: PAKET.price,
    items: [
      { productId: menu.id, quantity: 1 },
      { productId: side.id, quantity: 1 },
    ],
  });

  const date = Temporal.PlainDate.from(todayInJakarta()).add({ days: 2 }).toString();
  await openServiceDay({
    date,
    locations: ["MARKET_DAY", "CAMPUS_B"],
    windows: [{ startMinute: 600, endMinute: 660, quota: 10 }],
  });

  for (const [role, account] of Object.entries(STAFF)) {
    await db.orm.public.User.create({
      name: `E2E ${role}`,
      email: account.email,
      password: await bcrypt.hash(account.password, 10),
      role: role as "KASIR" | "DAPUR" | "ADMIN",
    });
  }

  process.env.E2E_SERVICE_DATE_LABEL = formatServiceDate(date);
  await db.close();
  process.env.DATABASE_URL = developmentUrl;
}
