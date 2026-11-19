import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { findActiveCharges } from "@/lib/queries/external-charge.query";
import { findByNumber, toTrackedOrder } from "@/lib/queries/order.query";
import { OrderTicket } from "@/components/public/order-ticket";
import { cn } from "@/lib/utils";
import { pageTitle } from "@/lib/brand";
import { photoboothLink } from "@/lib/photobooth-link";
import { PhotoboothQr } from "@/components/public/photobooth-qr";
import { QrisPayment } from "@/components/public/qris-payment";
import { getSettings } from "@/lib/services/setting.service";
import { ChatCard } from "@/components/public/whatsapp-chat";
import { chatOrderOf } from "@/lib/whatsapp";
import { isDelivered } from "@/lib/schedule";
import { normaliseOrderNumber } from "@/lib/order-number";

export const dynamic = "force-dynamic";

interface PageProps {
  // Next 15+ hands route params as a Promise; it has to be awaited.
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { orderNumber } = await params;
  return { title: pageTitle(`Pesanan ${normaliseOrderNumber(decodeURIComponent(orderNumber))}`) };
}

export default async function OrderConfirmationPage({ params }: PageProps) {
  const { orderNumber } = await params;

  // Read the way the proxy does, so a link typed in lower case finds its order.
  const found = await findByNumber(normaliseOrderNumber(decodeURIComponent(orderNumber)));
  if (!found) notFound();

  const [charges, settings] = await Promise.all([findActiveCharges([found.id]), getSettings()]);
  const order = toTrackedOrder(found, charges.get(found.id));
  // No token here: this page opens with the order number alone.
  const photoLink = photoboothLink(found, { withToken: false });

  const cancelled = order.status === "CANCELLED";
  const delivered = isDelivered(order);
  const instruction = cancelled ? null : handoverInstruction(order, delivered);

  return (
    <>
      {/*
        The design's "Level complete" screen: a banner that says the order went
        through, then the ticket. The whole point of this page is a number
        somebody will read out at a booth or screenshot for later, so the number
        is the page's <h1> — it sits on the ticket, set large — and the banner's
        line above it is a plain paragraph, however big it is drawn.
      */}
      <section className="pt-4 tablet:pt-6">
        <div className="band-inner stage-enter">
          <div className={cn("k-victory", cancelled && "k-victory-off")}>
            <p className="flex flex-wrap items-center gap-2">
              <span className="k-tag k-tag-yellow k-tag-flat">
                {cancelled ? "Game over" : "Victory clear!"}
              </span>
              {!cancelled && (
                <span aria-hidden="true" className="text-[var(--k-yellow)]">
                  ★★★
                </span>
              )}
            </p>
            <p className="k-victory-title">
              {cancelled ? "Pesanan dibatalkan" : "Level complete!"}
            </p>
            <p className="max-w-[34em] text-[14.5px] leading-relaxed text-white/85">
              {cancelled
                ? "Pesanan ini udah dibatalkan. Kalau menurut kamu ini keliru, chat kami ya."
                : `Yeay, pesanan kamu berhasil dibuat! Simpen nomornya atau screenshot halaman ini, nanti ditanya ${delivered ? "pas pesanannya kami antar" : "pas ambil"}.`}
            </p>
          </div>

          {/*
            Paying comes before the ticket: it is the one thing left for the
            customer to do, and the ticket carries a QR code of its own (the
            order number, for the cashier). With the ticket first, a customer
            reached for their e-wallet and scanned the wrong one.
          */}
          {order.paymentMethod === "QRIS" && !cancelled && (
            <QrisPayment
              orderNumber={order.orderNumber}
              totalAmount={order.totalAmount}
              qrisImageUrl={settings.qrisImageUrl ?? null}
              paymentStatus={order.paymentStatus}
              hasPaymentProof={order.hasPaymentProof}
              delivered={delivered}
              className="mt-5"
            />
          )}

          <OrderTicket order={order} numberAs="h1" className="mt-5" />
        </div>
      </section>

      <section className="band-tight menu-counter">
        {/* A narrow measure, left-aligned: the ticket above was for reading across
            a counter, this part is for reading properly. */}
        <div className="band-inner-narrow">
          {instruction && (
            <p
              className={cn(
                "border-l-2 py-3 pl-4 pr-3 text-[14px] leading-relaxed",
                instruction.tone === "warn"
                  ? "border-warn bg-warn-soft/70 text-warn"
                  : "border-sky-deep bg-sky-soft/70 text-sky-deep",
              )}
            >
              {instruction.text}
            </p>
          )}

          {order.notes && (
            <p className="mt-6 border-l-2 border-line pl-4 text-[13px] italic leading-relaxed text-ink-soft">
              {order.notes}
            </p>
          )}

          {photoLink && (
            <PhotoboothQr
              link={photoLink}
              orderNumber={order.orderNumber}
              direct={false}
              className="mt-9"
            />
          )}

          {/* Asking about this order, with its number and schedule already typed. */}
          <ChatCard
            className="mt-9"
            title={cancelled ? "Pembatalannya keliru?" : "Ada yang mau ditanyain?"}
            body="Chat kami di WhatsApp. Nomor pesanan dan jadwalnya udah otomatis ketulis."
            intent={{ kind: cancelled ? "cancelled" : "order", order: chatOrderOf(order) }}
            cta="Chat soal pesanan ini"
          />

          <div className="mt-10 flex flex-col gap-2.5 tablet:flex-row">
            <ButtonLink
              href={`/lacak?no=${encodeURIComponent(order.orderNumber)}`}
              variant="primary"
              className="tablet:flex-1"
            >
              Pantau pesanan live
            </ButtonLink>

            <ButtonLink href="/" variant="ghost" className="tablet:flex-1">
              Pesan lagi
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * What happens next at the handover, in one line. A Market Day order is
 * collected at the booth; a campus or Lainnya order is brought to the customer,
 * so it is never told to drop by or find the cashier. Made-to-order items are
 * the warning either way: they are made at the last moment, so they take a
 * little longer.
 */
function handoverInstruction(
  order: { needsPrep: boolean; awaitingLocationCheck: boolean },
  delivered: boolean,
): { tone: "warn" | "info"; text: string } {
  if (!delivered) {
    return order.needsPrep
      ? {
          tone: "warn",
          text: "Ada menu yang diracik dadakan, jadi disiapkan pas kamu datang. Tunjukin nomor ke kasir ya.",
        }
      : { tone: "info", text: "Semua pesanan kamu siap kemas, jadi tinggal ambil pas mampir." };
  }

  if (order.awaitingLocationCheck) {
    return {
      tone: "info",
      text: "Kalau lokasinya bisa kami jangkau, pesanan kamu kami antar sesuai jadwal di tiket.",
    };
  }

  return order.needsPrep
    ? {
        tone: "warn",
        text: "Ada menu yang diracik dadakan, jadi baru dibikin menjelang diantar biar masih fresh. Pas kami sampai, sebutin nomor pesanannya ya.",
      }
    : {
        tone: "info",
        text: "Pesanan kamu kami antar sesuai jadwal di tiket. Pas kami sampai, sebutin nomor pesanannya ya.",
      };
}
