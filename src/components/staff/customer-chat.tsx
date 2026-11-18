"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { useToast } from "@/components/ui/use-toast";
import { ChatGlyph } from "@/components/public/whatsapp-chat";
import { markLocationNotifiedAction } from "@/actions/kasir.actions";
import {
  CUSTOMER_TEMPLATE_LABEL,
  NOTIFYING_TEMPLATES,
  composeCustomerMessage,
  customerTemplates,
  needsLocationNotice,
  type StaffChatOrder,
} from "@/lib/customer-chat";
import { whatsappChatUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

/** "19 Nov, 14.05" in Jakarta time, wherever the screen is. */
const NOTIFIED_FORMAT = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

export interface CustomerChatProps {
  orderId: string;
  order: StaffChatOrder;
  /** The name the messages are signed with. */
  brand: string;
  className?: string;
}

/**
 * "Chat pelanggan" on an order's sheet: a WhatsApp message to the customer for
 * each thing worth telling them about this order, already written. A "Lainnya"
 * order also carries whether the customer has been told how the check of their
 * location went; opening that message marks it, and so does the button for a
 * customer told some other way.
 */
export function CustomerChat({ orderId, order, brand, className }: CustomerChatProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isMarking, setIsMarking] = React.useState(false);

  const headingId = React.useId();
  const pending = needsLocationNotice(order);
  const templates = customerTemplates(order);
  // Read when a link is drawn, which is only ever after a tap opened this sheet.
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const markNotified = async () => {
    if (isMarking) return;
    setIsMarking(true);
    const result = await markLocationNotifiedAction(orderId);
    setIsMarking(false);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    toast(`${result.data.orderNumber} ditandai sudah dikabari`);
    router.refresh();
  };

  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-2", className)}>
      <h3 id={headingId} className="s-eyebrow">
        Chat pelanggan
      </h3>

      {pending && (
        <Note variant="warn" className="flex flex-col gap-2">
          <span>
            Pelanggan belum dikabari hasil cek lokasinya. Kirim pesannya di bawah, atau tandai kalau udah
            dikabari lewat cara lain.
          </span>
          <Button
            variant="flat"
            size="sm"
            className="self-start"
            isLoading={isMarking}
            onClick={() => void markNotified()}
          >
            Udah dikabari
          </Button>
        </Note>
      )}

      {order.handoverLocation === "OTHER" && order.locationNotifiedAt && (
        <p className="text-[13px] font-semibold text-ok">
          Pelanggan udah dikabari hasil cek lokasinya ({NOTIFIED_FORMAT.format(new Date(order.locationNotifiedAt))}).
        </p>
      )}

      {whatsappChatUrl(order.customerPhone) ? (
        <ul className="flex flex-col gap-2">
          {templates.map((template, index) => {
            const href = whatsappChatUrl(
              order.customerPhone,
              composeCustomerMessage(template, order, { brand, origin }),
            )!;
            const notifies = pending && NOTIFYING_TEMPLATES.has(template);
            return (
              <li key={template}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={notifies ? () => void markNotified() : undefined}
                  className={cn(
                    "flex min-h-[46px] w-full items-center gap-2.5 rounded-[12px] px-3.5 text-left text-[14px] font-semibold transition-colors",
                    index === 0
                      ? "bg-[#0b7a3e] text-white hover:brightness-110"
                      : "border-[1.5px] border-line bg-white text-ink hover:bg-cream",
                  )}
                >
                  <ChatGlyph className={cn("h-5 w-5 flex-none", index === 0 ? "" : "text-[#0b7a3e]")} />
                  <span>{CUSTOMER_TEMPLATE_LABEL[template]}</span>
                  <span className="sr-only"> (buka WhatsApp)</span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-soft">
          {order.customerPhone
            ? `Nomor WhatsApp pelanggan (${order.customerPhone}) nggak bisa dipakai buat chat.`
            : "Pesanan ini nggak punya nomor WhatsApp pelanggan."}
        </p>
      )}
    </section>
  );
}
