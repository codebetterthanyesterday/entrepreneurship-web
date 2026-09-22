import { ButtonLink } from "@/components/ui/button";
import { NoticePage } from "@/components/site/notice-page";

export default function NotFound() {
  return (
    <NoticePage
      eyebrow="404"
      title="Halamannya nggak ada di sini."
      description="Mungkin link-nya salah ketik, atau halamannya sudah pindah. Menunya masih lengkap kok."
    >
      <ButtonLink href="/menu" className="bg-white text-ink-deep hover:bg-pink-soft">
        Lihat menu
      </ButtonLink>
      <ButtonLink
        href="/"
        className="border-2 border-white/40 bg-transparent text-white hover:bg-white/10"
      >
        Ke halaman depan
      </ButtonLink>
    </NoticePage>
  );
}
