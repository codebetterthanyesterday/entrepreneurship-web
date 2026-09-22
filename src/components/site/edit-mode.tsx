"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { EDIT_MODE_COOKIE } from "@/lib/site-content";


/**
 * The admin strip above the customer pages.
 *
 * The switch is only a preference, kept in a cookie so the server can render the
 * right tree — the edit controls exist in the HTML or they do not, rather than
 * being hidden with CSS. That also means an empty section (a gallery with no
 * photos yet) can be drawn for an editing admin and left out entirely for a
 * customer.
 *
 * Being a cookie, anyone can set it. That is fine and deliberate: it decides
 * nothing. The layout still only renders this strip for a signed-in ADMIN, and
 * every server action re-checks the role itself, so a forged cookie buys a
 * visitor nothing but a slightly different empty page.
 *
 * Default off, so an admin sees the page exactly as a customer does until they
 * ask to edit it.
 */
export function EditModeBar({ editing, name }: { editing: boolean; name: string | null }) {
  const router = useRouter();
  // `router.refresh()` is a transition, so the switch gets its own pending state
  // for free — no effect watching `editing` to decide when to re-enable itself.
  const [pending, startTransition] = React.useTransition();

  const setEditing = (next: boolean) => {
    // Session cookie — closing the browser leaves edit mode. Lax so it survives
    // ordinary navigation back from the admin panel.
    document.cookie = `${EDIT_MODE_COOKIE}=${next ? "1" : "0"}; path=/; SameSite=Lax`;
    // The server decides what the page contains, so the page has to be re-asked.
    startTransition(() => router.refresh());
  };

  return (
    <div className="bg-ink text-white">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-pink-soft">
            Admin
          </span>
          <span className="text-[12.5px] truncate">
            {editing ? "Ketuk teks buat ngedit" : name ? `Login sebagai ${name}` : "Mode baca"}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-none">
          <Link
            href="/admin"
            className="text-[12.5px] font-semibold underline underline-offset-2 hover:text-pink-soft"
          >
            Panel
          </Link>

          <label className="flex items-center gap-2 text-[12.5px] font-semibold">
            <span>Mode edit</span>
            <Switch
              checked={editing}
              onCheckedChange={setEditing}
              disabled={pending}
              aria-label="Mode edit halaman publik"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
