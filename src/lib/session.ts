import { auth } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import type { UserRole } from "@/types/order";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export async function requireRole(...allowed: string[]) {
  const user = await requireAuth();
  
  if (allowed.length > 0 && !allowed.includes(user.role)) {
    throw new ForbiddenError();
  }
  
  return user;
}

/**
 * The signed-in user as the services want them.
 *
 * The session carries `role` as a plain string while the services ask for the
 * `UserRole` union, so the narrowing has to happen somewhere. Here is that
 * somewhere: it is only sound directly after a `requireRole(...)` call, which
 * has already turned away anything outside the union.
 */
export function toActor(user: { id: string; role: string }): { id: string; role: UserRole } {
  return { id: user.id, role: user.role as UserRole };
}
