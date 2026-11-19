/** Shared by `playwright.config.ts`, the global setup and the specs. */

export const E2E_PORT = 3300;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
/** The staff sign-in address the e2e server answers at (STAFF_LOGIN_PATH). */
export const E2E_LOGIN_PATH = "/masuk-e2e-rahasia-uji";

/** Accounts the global setup creates in the test database. */
export const STAFF = {
  KASIR: { email: "kasir@e2e.test", password: "kasir-e2e-2026" },
  DAPUR: { email: "dapur@e2e.test", password: "dapur-e2e-2026" },
  ADMIN: { email: "admin@e2e.test", password: "admin-e2e-2026" },
} as const;

/** The one menu item, which needs the kitchen. */
export const MENU = { name: "Kopi Gladi E2E", price: 18_000 };
