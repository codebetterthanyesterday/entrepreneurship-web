"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="flex-none text-hot"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Keluar
    </Button>
  );
}
