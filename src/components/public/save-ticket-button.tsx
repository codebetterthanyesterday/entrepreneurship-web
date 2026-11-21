"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useSiteIdentity } from "@/components/site/site-identity";
import { ticketContent, ticketFileName } from "@/lib/ticket-image";
import type { TrackedOrder } from "@/types/order-view";

/**
 * "Simpan tiket": the ticket as a picture, for the phone's gallery, to show at
 * the booth even without signal.
 *
 * - On a phone that can share files, the share sheet opens, where "Simpan
 *   gambar" puts it in the gallery. The picture is drawn ahead, as soon as the
 *   ticket shows, because iOS only opens the sheet straight from the tap.
 * - Elsewhere it downloads as Tiket-PO-XXXXXX.png.
 *
 * It is drawn again whenever what it says changes (paid, a new handover),
 * so a saved ticket always matches the screen it was saved from.
 */
export function SaveTicketButton({ order }: { order: TrackedOrder }) {
  const { brandName } = useSiteIdentity();
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);

  // What the picture shows; drawn again only when that changes, not on every
  // poll of the tracker that hands over an equal order.
  const key = JSON.stringify([order, brandName]);
  const draw = React.useCallback(async (): Promise<File> => {
    const { renderTicket } = await import("@/lib/ticket-render");
    const blob = await renderTicket(ticketContent(order, brandName, window.location.host));
    return new File([blob], ticketFileName(order.orderNumber), { type: "image/png" });
  }, [order, brandName]);
  const drawAhead = React.useEffectEvent(() => draw());

  React.useEffect(() => {
    let live = true;
    drawAhead()
      .then((drawn) => live && setFile(drawn))
      .catch(() => live && setFile(null));
    return () => {
      live = false;
    };
  }, [key]);

  const download = (ready: File) => {
    const url = URL.createObjectURL(ready);
    const link = document.createElement("a");
    link.href = url;
    link.download = ready.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast("Tiket tersimpan sebagai gambar");
  };

  const save = async () => {
    let ready = file;
    if (!ready) {
      setBusy(true);
      try {
        ready = await draw();
        setFile(ready);
      } catch {
        toast("Tiketnya belum bisa disimpan. Screenshot halaman ini aja ya");
        return;
      } finally {
        setBusy(false);
      }
    }

    const sharing =
      window.matchMedia("(pointer: coarse)").matches &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [ready] });
    if (!sharing) {
      download(ready);
      return;
    }
    try {
      await navigator.share({ files: [ready], title: `Tiket ${order.orderNumber}` });
    } catch (error) {
      // Closing the share sheet is not a failure; anything else falls back to a download.
      if ((error as { name?: string }).name !== "AbortError") download(ready);
    }
  };

  return (
    <Button type="button" variant="primary" size="sm" fullWidth isLoading={busy} disabled={busy} onClick={() => void save()}>
      Simpan tiket (gambar)
    </Button>
  );
}
