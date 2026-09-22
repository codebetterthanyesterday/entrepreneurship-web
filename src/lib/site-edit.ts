import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/session";
import { EDIT_MODE_COOKIE } from "@/lib/site-content";

export interface SiteEditContext {
  /** Signed in as ADMIN. Only an admin ever sees the edit-mode strip. */
  isAdmin: boolean;
  /** Admin *and* edit mode switched on — the flag every editable block reads. */
  editing: boolean;
  name: string | null;
}

const READ_ONLY: SiteEditContext = { isAdmin: false, editing: false, name: null };

/**
 * Whether this request should be served editable markup.
 *
 * The role is read from the session, never from the cookie: the cookie only says
 * which of the two views an admin asked for. A visitor who sets it themselves
 * gets `READ_ONLY` here, and the server actions would refuse them anyway.
 */
export async function getSiteEditContext(): Promise<SiteEditContext> {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return READ_ONLY;

  const jar = await cookies();

  return {
    isAdmin: true,
    editing: jar.get(EDIT_MODE_COOKIE)?.value === "1",
    name: user.name ?? null,
  };
}
