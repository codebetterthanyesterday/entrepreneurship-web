"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

/**
 * Signs out and lands on the sign-in page, at its secret address. The address
 * comes from the server as a prop: this button only ever renders for someone
 * signed in, so it never reaches a visitor's page.
 */
export function LogoutButton({ loginPath }: { loginPath: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="flex-none text-hot"
      onClick={() => signOut({ callbackUrl: loginPath })}
    >
      Keluar
    </Button>
  );
}
