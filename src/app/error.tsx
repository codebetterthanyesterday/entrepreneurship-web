"use client";

import * as React from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { NoticePage } from "@/components/site/notice-page";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <NoticePage
      eyebrow="Ada yang salah"
      title="Halaman ini gagal dimuat."
      description="Bukan salah kamu. Coba muat ulang dulu — kalau masih sama, kabarin kami lewat WhatsApp ya."
    >
      <Button
        onClick={() => reset()}
        className="bg-white text-ink-deep hover:bg-pink-soft"
      >
        Coba lagi
      </Button>
      <ButtonLink
        href="/menu"
        className="border-2 border-white/40 bg-transparent text-white hover:bg-white/10"
      >
        Lihat menu
      </ButtonLink>
    </NoticePage>
  );
}
