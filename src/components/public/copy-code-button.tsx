"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

/**
 * Copies the order number, for pasting into a chat or a note.
 *
 * Beside "Simpan tiket" (`SaveTicketButton`), which saves the whole ticket
 * as a picture; this is for when only the number is wanted.
 *
 * A browser may refuse the clipboard (an insecure origin, a denied
 * permission). The number is right there on the ticket, so the fallback is to
 * say it again in the toast rather than to fail silently.
 */
export function CopyCodeButton({ code }: { code: string }) {
  const { toast } = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast(`Nomor ${code} disalin`);
    } catch {
      toast(`Nomor pesanan kamu: ${code}`);
    }
  };

  return (
    <Button type="button" variant="ghost" size="sm" fullWidth onClick={() => void copy()}>
      Salin nomor pesanan
    </Button>
  );
}
