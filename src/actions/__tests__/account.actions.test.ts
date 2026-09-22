import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// There is no request, so no NextAuth session either. The signed-in user is
// whatever the test puts here.
const session = vi.hoisted(() => ({
  user: null as { id: string; name: string; role: string } | null,
}));

vi.mock("@/lib/session", async () => {
  const { UnauthorizedError } = await import("@/lib/errors");
  return {
    toActor: (user: { id: string; role: string }) => ({ id: user.id, role: user.role }),
    requireAuth: async () => {
      if (!session.user) throw new UnauthorizedError();
      return session.user;
    },
    requireRole: async (...allowed: string[]) => {
      const { ForbiddenError } = await import("@/lib/errors");
      if (!session.user) throw new UnauthorizedError();
      if (!allowed.includes(session.user.role)) throw new ForbiddenError();
      return session.user;
    },
  };
});

const bcrypt = (await import("bcryptjs")).default;
const { changePasswordAction } = await import("@/actions/account.actions");
const { needsPasswordChange } = await import("@/lib/services/account.service");
const { initialPasswordFor } = await import("@/lib/initial-password");
const { prisma: db } = await import("@/lib/prisma");
const { closeDatabase, resetDatabase } = await import("@/lib/services/__tests__/helpers/test-db");

type Role = "ADMIN" | "KASIR" | "DAPUR";

async function makeCrewMember(name: string, role: Role, plain = initialPasswordFor(name)) {
  const user = await db.orm.public.User.create({
    name,
    email: `${name.toLowerCase()}@md.test`,
    password: await bcrypt.hash(plain, 10),
    role,
    mustChangePassword: true,
    isActive: true,
  });

  return user;
}

function signIn(user: { id: string; name: string; role: string }) {
  session.user = { id: user.id, name: user.name, role: user.role };
}

async function storedPassword(id: string): Promise<string> {
  const user = await db.orm.public.User.where({ id }).first();
  return user!.password;
}

beforeEach(async () => {
  await resetDatabase();
  session.user = null;
});

afterAll(async () => {
  await closeDatabase();
});

/**
 * The accounts are handed out with `<nama>123`, which every member of the crew can
 * guess for every other member — and the e-mail pattern is just as guessable. So
 * the one thing that has to hold is that this action changes the password of
 * whoever is *signed in*, and can never be talked into changing somebody else's.
 */
describe("whose password gets changed", () => {
  it("refuses a caller who is not signed in", async () => {
    const farel = await makeCrewMember("Farel", "KASIR");
    const before = await storedPassword(farel.id);

    const result = await changePasswordAction({
      currentPassword: "farel123",
      newPassword: "rahasia-baru",
      confirmPassword: "rahasia-baru",
    });

    expect(result.ok).toBe(false);
    expect(await storedPassword(farel.id)).toBe(before);
  });

  it("ignores a userId smuggled in through the payload", async () => {
    const fathin = await makeCrewMember("Fathin", "ADMIN");
    const keisha = await makeCrewMember("Keisha", "DAPUR");
    const adminPassword = await storedPassword(fathin.id);

    signIn(keisha);

    // Keisha knows Fathin's starting password — everybody does — and tries to
    // aim the change at his account.
    const result = await changePasswordAction({
      userId: fathin.id,
      currentPassword: "fathin123",
      newPassword: "password-baru-keisha",
      confirmPassword: "password-baru-keisha",
    });

    // It fails on Keisha's own current password, and Fathin is untouched either way.
    expect(result.ok).toBe(false);
    expect(await storedPassword(fathin.id)).toBe(adminPassword);
  });

  it("changes only the signed-in account, even when a userId is supplied", async () => {
    const fathin = await makeCrewMember("Fathin", "ADMIN");
    const keisha = await makeCrewMember("Keisha", "DAPUR");
    const adminPassword = await storedPassword(fathin.id);

    signIn(keisha);

    const result = await changePasswordAction({
      userId: fathin.id,
      // Keisha's own current password, so validation passes.
      currentPassword: "keisha123",
      newPassword: "punyaku-sendiri",
      confirmPassword: "punyaku-sendiri",
    });

    expect(result.ok).toBe(true);
    expect(await storedPassword(fathin.id)).toBe(adminPassword);
    expect(await bcrypt.compare("punyaku-sendiri", await storedPassword(keisha.id))).toBe(true);
  });

  it.each(["ADMIN", "KASIR", "DAPUR"] as const)("lets %s change their own", async (role) => {
    const user = await makeCrewMember("Tegar", role);
    signIn(user);

    const result = await changePasswordAction({
      currentPassword: "tegar123",
      newPassword: "password-tegar-baru",
      confirmPassword: "password-tegar-baru",
    });

    expect(result.ok).toBe(true);
  });
});

describe("what a new password has to be", () => {
  it("needs the current password to be right", async () => {
    const user = await makeCrewMember("Cahya", "DAPUR");
    signIn(user);
    const before = await storedPassword(user.id);

    const result = await changePasswordAction({
      currentPassword: "salah-total",
      newPassword: "password-cahya-baru",
      confirmPassword: "password-cahya-baru",
    });

    expect(result.ok).toBe(false);
    expect(await storedPassword(user.id)).toBe(before);
  });

  it("refuses the starting password the whole team was told", async () => {
    // Nabilah changed hers, then tries to set it back to the shared default.
    const user = await makeCrewMember("Nabilah", "DAPUR", "sudah-diganti");
    signIn(user);

    const result = await changePasswordAction({
      currentPassword: "sudah-diganti",
      newPassword: initialPasswordFor("Nabilah"),
      confirmPassword: initialPasswordFor("Nabilah"),
    });

    expect(result.ok).toBe(false);
  });

  it("refuses a password under eight characters", async () => {
    const user = await makeCrewMember("Komang", "ADMIN");
    signIn(user);

    const result = await changePasswordAction({
      currentPassword: "komang123",
      newPassword: "pendek",
      confirmPassword: "pendek",
    });

    expect(result.ok).toBe(false);
  });

  it("refuses a confirmation that does not match", async () => {
    const user = await makeCrewMember("Fatihul", "ADMIN");
    signIn(user);

    const result = await changePasswordAction({
      currentPassword: "fatihul123",
      newPassword: "password-yang-baru",
      confirmPassword: "password-yang-beda",
    });

    expect(result.ok).toBe(false);
  });
});

describe("the starting-password notice", () => {
  it("is on for a fresh account and off once the password is changed", async () => {
    const user = await makeCrewMember("Farel", "KASIR");
    signIn(user);

    expect(await needsPasswordChange(user.id)).toBe(true);

    const result = await changePasswordAction({
      currentPassword: "farel123",
      newPassword: "kasir-punya-sendiri",
      confirmPassword: "kasir-punya-sendiri",
    });

    expect(result.ok).toBe(true);
    expect(await needsPasswordChange(user.id)).toBe(false);
  });
});

describe("a retired account", () => {
  it("cannot change its password with a session that outlived the deactivation", async () => {
    // Sessions are twelve-hour JWTs, so deactivating somebody does not log them
    // out. The service checks the row rather than trusting the token.
    const user = await makeCrewMember("Nadia", "KASIR");
    signIn(user);
    await db.orm.public.User.where({ id: user.id }).update({ isActive: false });

    const result = await changePasswordAction({
      currentPassword: "nadia123",
      newPassword: "mau-masuk-lagi",
      confirmPassword: "mau-masuk-lagi",
    });

    expect(result.ok).toBe(false);
  });
});
