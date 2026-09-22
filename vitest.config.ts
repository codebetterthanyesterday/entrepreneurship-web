import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

loadEnv({ path: ".env.local", quiet: true });

const testDatabaseUrl = process.env.DATABASE_URL_TEST;

if (!testDatabaseUrl) {
  throw new Error(
    "DATABASE_URL_TEST is not set. Tests truncate every table they touch, so they " +
      "refuse to run without a database of their own — add DATABASE_URL_TEST to .env.local.",
  );
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL_TEST points at the development database. Use a separate one.");
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // .tsx too: some behaviour only shows up once a component is assembled —
    // the kitchen board keeping its tickets through an outage, for one.
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    // Every suite talks to the same database, so they run one file at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
    },
  },
});
