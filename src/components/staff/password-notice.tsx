"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The yellow nudge under the strip while the account still has the password
 * the accounts script handed out. Every screen shows it except Akun itself,
 * which says the same thing above the form it points to.
 */
export function PasswordNotice() {
  const pathname = usePathname();
  if (pathname === "/akun") return null;

  return (
    <Link href="/akun" className="s-notice">
      <span className="s-wrap">
        <span aria-hidden="true" className="s-notice-icon">
          !
        </span>
        <span>
          Akun kamu masih pakai password awal yang dibagikan bareng-bareng.{" "}
          <b className="underline underline-offset-2">Ganti sekarang &rarr;</b>
        </span>
      </span>
    </Link>
  );
}
