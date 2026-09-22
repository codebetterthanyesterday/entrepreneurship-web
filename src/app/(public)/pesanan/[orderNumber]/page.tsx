import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { findByNumber, toTrackedOrder } from "@/lib/queries/order.query";
import { OrderReceipt } from "@/components/public/order-receipt";
import { cn } from "@/lib/utils";
import { pageTitle } from "@/lib/brand";

export const dynamic = "force-dynamic";

interface PageProps {
  // Next 15+ hands route params as a Promise; it has to be awaited.
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { orderNumber } = await params;
  return { title: pageTitle(`Pesanan ${decodeURIComponent(orderNumber)}`) };
}

export default async function OrderConfirmationPage({ params }: PageProps) {
  const { orderNumber } = await params;

  const found = await findByNumber(decodeURIComponent(orderNumber));
  if (!found) notFound();

  const order = toTrackedOrder(found);

  const instruction = order.needsPrep
    ? {
        tone: "warn" as const,
        text: "Ada menu yang diracik dadakan, jadi disiapkan pas kamu datang. Tunjukin nomor ke kasir ya.",
      }
    : {
        tone: "info" as const,
        text: "Semua pesanan kamu siap kemas, jadi tinggal ambil pas mampir.",
      };

  return (
    <>
      {/*
        The whole point of this page is a number somebody will read out at a booth
        or screenshot for later, so the number is the page and everything else gets
        out of its way. Centred, on the dark field, at display size — and without
        the party emoji that used to sit on top of it, which said nothing the
        heading does not already say.
      */}
      <section className="band band-dark band-glow">
        <div className="band-inner text-center">
          <p className="eyebrow text-pink">Pesanan diterima</p>

          {/*
            The number is the page's subject, so it is the page's <h1> — the
            visual hierarchy and the heading hierarchy agree for once. The label
            above it is drawn for sighted readers and hidden from assistive tech,
            which gets the same words from inside the heading instead of hearing
            them twice.
          */}
          <p
            aria-hidden="true"
            className="mt-8 text-[12px] font-semibold uppercase tracking-[0.2em] text-white/55"
          >
            Nomor pesanan
          </p>
          <h1 className="display-1 mt-2 text-white tabular-nums">
            <span className="sr-only">Nomor pesanan </span>
            {order.orderNumber}
          </h1>

          <p className="mt-8 text-[14px] text-white/70">
            Atas nama <span className="font-semibold text-white">{order.customerName}</span>
            {order.pickupSlot && (
              <>
                {" "}
                &middot; ambil jam{" "}
                <span className="font-semibold tabular-nums text-white">{order.pickupSlot}</span>
              </>
            )}
          </p>
        </div>
      </section>

      <section className="band-tight band-cream">
        {/* A narrow measure, left-aligned: the number above was for reading across
            a counter, this part is for reading properly. */}
        <div className="band-inner-narrow">
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

          <div className="mt-9">
            <OrderReceipt
              lines={order.items.map((item, index) => ({
                key: `${item.name}-${index}`,
                name: item.name,
                quantity: item.quantity,
                subtotal: item.subtotal,
              }))}
              total={order.totalAmount}
              title="Yang kamu pesan"
            />
          </div>

          {order.notes && (
            <p className="mt-6 border-l-2 border-line pl-4 text-[13px] italic leading-relaxed text-ink-soft">
              {order.notes}
            </p>
          )}

          <div className="mt-10 flex flex-col gap-2.5 tablet:flex-row">
            <ButtonLink
              href={`/lacak?no=${encodeURIComponent(order.orderNumber)}`}
              variant="primary"
              className="tablet:flex-1"
            >
              Lacak pesanan
            </ButtonLink>

            <ButtonLink href="/menu" variant="ghost" className="tablet:flex-1">
              Pesan lagi
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
