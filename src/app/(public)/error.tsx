"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { NoticePage } from "@/components/site/notice-page";
import { ChatHoursNote, ChatLink } from "@/components/public/whatsapp-chat";

/**
 * A customer page that failed, inside the public layout, so the header, the
 * footer and the team's chat are still there. The root `app/error.tsx` stays
 * for the rare failure of the layout itself, which has no chat to offer.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <NoticePage
      eyebrow="Ada yang salah"
      title="Halaman ini gagal dimuat."
      description="Bukan salah kamu. Coba muat ulang dulu. Kalau masih sama, chat kami ya, biar kami cek."
    >
      <Button onClick={() => reset()} className="bg-white text-ink-deep hover:bg-pink-soft">
        Coba lagi
      </Button>
      <ButtonLink
        href="/"
        className="border-2 border-white/40 bg-transparent text-white hover:bg-white/10"
      >
        Lihat menu
      </ButtonLink>
      <div className="flex w-full flex-col items-start gap-1">
        <ChatLink intent={{ kind: "pageError", path: pathname, digest: error.digest }} look="outline" tone="dark">
          Laporkan ke kami
        </ChatLink>
        <ChatHoursNote tone="dark" />
      </div>
    </NoticePage>
  );
}
