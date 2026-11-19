import { afterAll, beforeEach, describe, expect, it } from "vitest";

const { checkRateLimit, hitRateLimit, waitLabel } = await import("@/lib/services/rate-limit.service");
const { prisma: db } = await import("@/lib/prisma");
const { closeDatabase, resetDatabase } = await import("@/lib/services/__tests__/helpers/test-db");

const LIMIT = { name: "uji", max: 3, windowSeconds: 600 };

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

/** Moves every window back, as if `seconds` had passed. */
async function age(seconds: number) {
  await db.runtime().execute(
    db.raw.sql`UPDATE "public"."rateLimit" SET "windowStart" = "windowStart" - make_interval(secs => ${seconds}::double precision)`
      .affectedCount()
      .build(),
  );
}

describe("hitRateLimit", () => {
  it("lets requests through up to the limit and refuses the one after", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await hitRateLimit(LIMIT, "203.0.113.7"));

    expect(results.map((result) => result.allowed)).toEqual([true, true, true, false]);
    expect(results[3]!.retryAfterSeconds).toBeGreaterThan(590);
    expect(results[3]!.retryAfterSeconds).toBeLessThanOrEqual(600);
  });

  it("counts every caller apart", async () => {
    for (let i = 0; i < 3; i++) await hitRateLimit(LIMIT, "203.0.113.7");

    expect((await hitRateLimit(LIMIT, "203.0.113.8")).allowed).toBe(true);
    expect((await hitRateLimit({ ...LIMIT, name: "lain" }, "203.0.113.7")).allowed).toBe(true);
  });

  it("starts again once the window has passed", async () => {
    for (let i = 0; i < 4; i++) await hitRateLimit(LIMIT, "203.0.113.7");
    await age(601);

    expect((await hitRateLimit(LIMIT, "203.0.113.7")).allowed).toBe(true);
  });

  it("counts correctly when many requests land at once", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => hitRateLimit(LIMIT, "203.0.113.7")));

    expect(results.filter((result) => result.allowed)).toHaveLength(3);
  });

  it("never stores the subject itself", async () => {
    await hitRateLimit(LIMIT, "081234567890");
    const rows = await db.orm.public.RateLimit.all();

    expect(rows).toHaveLength(1);
    expect(rows[0]!.key).not.toContain("081234567890");
  });
});

describe("checkRateLimit", () => {
  it("looks without counting", async () => {
    for (let i = 0; i < 5; i++) expect((await checkRateLimit(LIMIT, "x")).allowed).toBe(true);
    expect(await db.orm.public.RateLimit.all()).toHaveLength(0);
  });

  it("refuses once the failures reach the limit, until the window passes", async () => {
    for (let i = 0; i < 3; i++) await hitRateLimit(LIMIT, "x");
    expect((await checkRateLimit(LIMIT, "x")).allowed).toBe(false);

    await age(601);
    expect((await checkRateLimit(LIMIT, "x")).allowed).toBe(true);
  });
});

describe("waitLabel", () => {
  it("rounds up to whole minutes, never zero", () => {
    expect(waitLabel(0)).toBe("1 menit");
    expect(waitLabel(61)).toBe("2 menit");
    expect(waitLabel(900)).toBe("15 menit");
  });
});
