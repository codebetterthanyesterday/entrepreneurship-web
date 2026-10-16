import { renderSVG } from "uqr";
import { cn } from "@/lib/utils";

interface PhotoboothQrProps {
  /** From `photoboothLink`; never built on the client. */
  link: string;
  orderNumber: string;
  /** True when the link carries a token and opens the photos directly. */
  direct: boolean;
  className?: string;
}

/**
 * The way into the photobooth: a QR code for scanning at the booth or on
 * another phone, the order number printed under it as the prototype shows,
 * and the same link to tap on this phone.
 *
 * The SVG comes from our own link through `uqr`, never from user input, which
 * is why it is safe to set as markup.
 */
export function PhotoboothQr({ link, orderNumber, direct, className }: PhotoboothQrProps) {
  const svg = renderSVG(link, { border: 1, ecc: "M" });

  return (
    <section
      aria-labelledby="photobooth-qr-title"
      className={cn("flex items-center gap-5 border-y border-line py-5", className)}
    >
      <a
        href={link}
        className="block w-[7.5rem] flex-none rounded-md bg-white p-1.5 tablet:w-[8.5rem]"
        aria-label={`Buka foto photobooth untuk ${orderNumber}`}
      >
        <span
          className="block [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <span className="mt-1 block text-center text-[11px] font-semibold tracking-[0.08em] tabular-nums text-ink">
          {orderNumber}
        </span>
      </a>
      <div className="min-w-0">
        <h2 id="photobooth-qr-title" className="eyebrow text-pink-deep">
          Foto photobooth
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink">
          {direct
            ? "Scan atau ketuk buat buka foto kamu dari booth, langsung tanpa isi kode lagi."
            : "Scan atau ketuk buat buka foto kamu dari booth. Nanti tinggal isi 4 digit terakhir WhatsApp kamu."}
        </p>
        <a
          href={link}
          className="mt-2 inline-block text-[13px] font-semibold text-pink-deep underline underline-offset-4"
        >
          Buka foto saya
        </a>
      </div>
    </section>
  );
}
