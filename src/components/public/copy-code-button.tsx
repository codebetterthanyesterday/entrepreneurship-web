"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

/**
 * Copies the order number, for pasting into a chat or a note.
 *
 * The design's ticket has "Simpan tiket" here. Saving a picture of the ticket
 * would need the page rendered to an image; what a customer is actually asked
 * for at the booth is the number, so that is what this hands over — and it says
 * so on the label rather than promising a file.
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
    <Button type="button" variant="done" size="sm" fullWidth onClick={() => void copy()}>
      Salin nomor pesanan
    </Button>
  );
}
