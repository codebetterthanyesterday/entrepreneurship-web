import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_LOGIN_PATH, E2E_PORT } from "./e2e/constants";

/**
 * End-to-end tests of the day as customers and staff live it, through the
 * real screens of a production build. They run against DATABASE_URL_TEST,
 * which `e2e/global-setup.ts` empties and fills, never the development or
 * production database, and on port 3300, clear of `next dev` on 3000.
 *
 *   npm run test:e2e
 */
loadEnv({ path: ".env.local", quiet: true });

const testDatabaseUrl = process.env.DATABASE_URL_TEST;
if (!testDatabaseUrl || testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL_TEST must be set to a database of its own: the e2e setup empties it.");
}


export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // One database, so one test at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,

  use: {
    baseURL: E2E_BASE_URL,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    command: `npx next build && npx next start -p ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      STAFF_LOGIN_PATH: E2E_LOGIN_PATH,
      AUTH_TRUST_HOST: "true",
      PHOTOBOOTH_URL: "",
    },
  },
});
