import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma as db } from "@/lib/prisma";
import { clientIp } from "@/lib/client-ip";
import { LIMITS, checkRateLimit, hitRateLimit } from "@/lib/services/rate-limit.service";

/**
 * Too many failed sign-ins lately, for this email or from this address. The
 * form reads the code and says to wait; no password is checked meanwhile, so a
 * right guess during the pause is refused like a wrong one.
 */
class TooManySignIns extends CredentialsSignin {
  code = "terlalu_sering";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Kredensial",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Failures are counted per email and per address (`LIMITS`), and
        // checked before the password is, so nobody can keep guessing.
        const email = String(credentials.email);
        const ip = clientIp(request.headers);
        const [byEmail, byIp] = await Promise.all([
          checkRateLimit(LIMITS.loginFailPerEmail, email),
          checkRateLimit(LIMITS.loginFailPerIp, ip),
        ]);
        if (!byEmail.allowed || !byIp.allowed) {
          throw new TooManySignIns();
        }

        const user = await verifyCredentials(email, String(credentials.password));
        if (!user) {
          await Promise.all([
            hitRateLimit(LIMITS.loginFailPerEmail, email),
            hitRateLimit(LIMITS.loginFailPerIp, ip),
          ]);
          return null;
        }
        return user;
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 12 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    }
  },
  pages: {
    // Deliberately the plain /login, which answers 404 once STAFF_LOGIN_PATH is
    // set (`@/lib/staff-entrance`). Auth.js names this page in every redirect it
    // makes, to anyone (GET /api/auth/signin, a failed sign-in), so the secret
    // address must never be here. The real form signs in with
    // `redirect: false` and handles the answer itself.
    signIn: '/login',
  }
});

/** The account behind an email and password, or null for any kind of mismatch. */
async function verifyCredentials(email: string, password: string) {
  const user = await db.orm.public.User.where({ email }).first();

  if (!user || !user.password) {
    return null;
  }

  // A retired account keeps its row — its name is attached to orders it
  // handled, and the history has to stay readable — but it stops being a
  // way in. Checked before the password so a deactivated account cannot be
  // probed for a valid one.
  if (!user.isActive) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    return null;
  }

  return {
    id: user.id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
