import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// revalidatePath needs a request scope that does not exist in a test process.
// The action's caching behaviour is not what these tests are about.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// There is no request, so no NextAuth session either. The signed-in user is
// whatever the test puts here; requireRole keeps its real role check.
const session = vi.hoisted(() => ({
  user: null as { id: string; name: string; role: string } | null,
}));

vi.mock("@/lib/session", async () => {
  const { ForbiddenError, UnauthorizedError } = await import("@/lib/errors");
  return {
    toActor: (user: { id: string; role: string }) => ({ id: user.id, role: user.role }),
    requireRole: async (...allowed: string[]) => {
      if (!session.user) throw new UnauthorizedError();
      if (!allowed.includes(session.user.role)) throw new ForbiddenError();
      return session.user;
    },
  };
});

const {
  deleteSiteListItemAction,
  moveSiteListItemAction,
  resetSiteTextAction,
  updateSiteTextAction,
  upsertSiteListItemAction,
} = await import("@/actions/site.actions");
const { getSiteLists, getSiteTexts } = await import("@/lib/queries/site.query");
const { SITE_TEXT_DEFAULTS } = await import("@/lib/site-content");
const { closeDatabase, makeUser, resetDatabase } = await import(
  "@/lib/services/__tests__/helpers/test-db"
);

async function signIn(role: "ADMIN" | "KASIR" | "DAPUR") {
  const user = await makeUser(role);
  session.user = { id: user.id, name: user.name, role };
  return user;
}

beforeEach(async () => {
  await resetDatabase();
  session.user = null;
});

afterAll(async () => {
  await closeDatabase();
});

/**
 * The profile is edited straight on the public page, and the switch that reveals
 * the controls is only a cookie — anyone can set it, and anyone can call a server
 * action directly. So the role check on the server is the whole of the
 * protection, and these tests are what keeps it that way.
 */
describe("who may edit the public profile", () => {
  const edit = () =>
    updateSiteTextAction({ key: "hero.title", value: "Diubah", version: 0 });

  it("refuses a visitor who is not signed in", async () => {
    const result = await edit();

    expect(result.ok).toBe(false);
    expect((await getSiteTexts())["hero.title"].value).toBe(SITE_TEXT_DEFAULTS["hero.title"]);
  });

  it.each(["KASIR", "DAPUR"] as const)("refuses %s, who may not edit the site", async (role) => {
    await signIn(role);

    const result = await edit();

    expect(result.ok).toBe(false);
    expect((await getSiteTexts())["hero.title"].value).toBe(SITE_TEXT_DEFAULTS["hero.title"]);
  });

  it("allows ADMIN", async () => {
    await signIn("ADMIN");

    const result = await edit();

    expect(result.ok).toBe(true);
    expect((await getSiteTexts())["hero.title"].value).toBe("Diubah");
  });

  it.each(["KASIR", "DAPUR"] as const)("refuses %s on every list action too", async (role) => {
    // Set the list up as an admin, then check the other roles cannot touch it.
    await signIn("ADMIN");
    const created = await upsertSiteListItemAction({ section: "team", title: "Nadia" });
    expect(created.ok).toBe(true);

    const [item] = (await getSiteLists()).team;
    expect(item).toBeDefined();

    await signIn(role);

    for (const attempt of [
      () => upsertSiteListItemAction({ id: item!.id, section: "team", title: "Dibajak", version: item!.version }),
      () => moveSiteListItemAction({ id: item!.id, direction: "up" }),
      () => deleteSiteListItemAction({ id: item!.id }),
      () => resetSiteTextAction({ key: "team.heading" }),
    ]) {
      expect((await attempt()).ok).toBe(false);
    }

    const after = (await getSiteLists()).team;
    expect(after).toHaveLength(1);
    expect(after[0]!.title).toBe("Nadia");
  });
});

describe("what the actions accept", () => {
  beforeEach(async () => {
    await signIn("ADMIN");
  });

  it("rejects a key the code does not know, rather than storing it", async () => {
    const result = await updateSiteTextAction({ key: "hero.evil", value: "x", version: 0 });

    expect(result.ok).toBe(false);
  });

  it("rejects an empty value for a block that has to say something", async () => {
    const result = await updateSiteTextAction({ key: "hero.title", value: "   ", version: 0 });

    expect(result.ok).toBe(false);
    expect((await getSiteTexts())["hero.title"].value).toBe(SITE_TEXT_DEFAULTS["hero.title"]);
  });

  it("accepts an empty value for a block that is allowed to be absent", async () => {
    // An Instagram handle nobody has filled in must be storable as empty, which
    // is how the footer knows not to print a dead link.
    const result = await updateSiteTextAction({ key: "contact.instagram", value: "", version: 0 });

    expect(result.ok).toBe(true);
  });

  it("rejects an image field that is not a URL", async () => {
    const result = await upsertSiteListItemAction({
      section: "gallery",
      title: "Booth",
      imageUrl: "bukan-link",
    });

    expect(result.ok).toBe(false);
  });

  it("reports a lost race with the text that won it", async () => {
    await updateSiteTextAction({ key: "story.heading", value: "Punyaku", version: 0 });

    const result = await updateSiteTextAction({ key: "story.heading", value: "Punyamu", version: 0 });

    expect(result.ok).toBe(false);
    expect(result).toHaveProperty("current", "Punyaku");
  });

  it("puts a block back to its default", async () => {
    await updateSiteTextAction({ key: "hero.tagline", value: "Sementara", version: 0 });

    const result = await resetSiteTextAction({ key: "hero.tagline" });

    expect(result.ok).toBe(true);
    expect((await getSiteTexts())["hero.tagline"].value).toBe(SITE_TEXT_DEFAULTS["hero.tagline"]);
  });
});
