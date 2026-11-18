"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { chatHoursLabel, composeChatMessage, isWithinChatHours, whatsappChatUrl, type ChatHours, type ChatIntent } from "@/lib/whatsapp";
import { clockLabel } from "@/lib/schedule";

/**
 * The team's WhatsApp, for every customer page. The public layout reads it
 * from store settings once and provides it here, so a button deep in a page
 * (the ticket, the tracker, an error) needs nothing passed down to it.
 *
 * With no number set, there is no context value and every button renders
 * nothing: a hidden button is better than a link to nowhere.
 */
export interface WhatsappContact extends ChatHours {
  number: string;
  brand: string;
}

const WhatsappContext = React.createContext<WhatsappContact | null>(null);

export function WhatsappProvider({
  contact,
  children,
}: {
  contact: WhatsappContact | null;
  children: React.ReactNode;
}) {
  return <WhatsappContext.Provider value={contact}>{children}</WhatsappContext.Provider>;
}

export function useWhatsappContact(): WhatsappContact | null {
  return React.useContext(WhatsappContext);
}

/**
 * Whether the team is answering right now, decided in the browser after it
 * mounts: the server's render cannot know the visitor's moment, and guessing
 * would flash the wrong line. `null` until then.
 */
function useAnsweringNow(contact: WhatsappContact | null): boolean | null {
  const [answering, setAnswering] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    if (!contact) return;
    const update = () => setAnswering(isWithinChatHours(contact));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [contact]);
  return answering;
}

/** One line under a chat button: when it will be answered. */
export function ChatHoursNote({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const contact = useWhatsappContact();
  const answering = useAnsweringNow(contact);
  if (!contact) return null;

  const text =
    answering === false
      ? `Lagi di luar jam balas. Chat aja, kami balas mulai ${clockLabel(contact.openMinute)} WIB.`
      : `Dibalas jam ${chatHoursLabel(contact)}.`;

  return (
    <p className={cn("text-[12.5px] leading-snug", tone === "dark" ? "text-white/80" : "text-ink-soft", className)}>
      {text}
    </p>
  );
}

export interface ChatLinkProps {
  /** Which message is typed in for the customer. */
  intent: ChatIntent;
  children: React.ReactNode;
  /** `solid` for the one action on a card; `quiet` for a link inside text. */
  look?: "solid" | "outline" | "quiet";
  tone?: "light" | "dark";
  className?: string;
}

/** A link that opens WhatsApp to the team, with `message` already written. */
export function ChatLink({ intent, children, look = "solid", tone = "light", className }: ChatLinkProps) {
  const contact = useWhatsappContact();
  if (!contact) return null;
  const href = whatsappChatUrl(contact.number, composeChatMessage(contact.brand, intent));
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        look === "quiet"
          ? cn(
              "inline-flex min-h-[44px] items-center gap-1.5 font-semibold underline underline-offset-4",
              tone === "dark" ? "text-white" : "text-pink-deep",
            )
          : cn(
              "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 text-[14.5px] font-semibold transition-colors",
              look === "solid"
                ? "bg-[#0b7a3e] text-white hover:brightness-110"
                : tone === "dark"
                  ? "border-2 border-white/50 text-white hover:bg-white/10"
                  : "border-2 border-[#0b7a3e] bg-white text-[#0b7a3e] hover:bg-[#e8f6ee]",
            ),
        className,
      )}
    >
      {look !== "quiet" && <ChatGlyph className="h-5 w-5 flex-none" />}
      <span>{children}</span>
      <span className="sr-only"> (buka WhatsApp)</span>
    </a>
  );
}

/** The chat entry in the header, beside the bag: a question before ordering. */
export function HeaderChat() {
  const contact = useWhatsappContact();
  if (!contact) return null;
  const href = whatsappChatUrl(contact.number, composeChatMessage(contact.brand, { kind: "general" }));
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Tanya kami lewat WhatsApp"
      className="k-chat"
    >
      <ChatGlyph className="h-5 w-5 flex-none" />
      <span className="k-chat-label">Tanya</span>
    </a>
  );
}

/** A speech bubble with a handset: WhatsApp's shape without its trademark. */
function ChatGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 8.2c.2-.4.5-.4.8-.4h.5c.2 0 .4.1.5.4l.6 1.5c.1.3 0 .5-.1.7l-.5.6c.6 1.1 1.4 1.9 2.5 2.5l.6-.5c.2-.2.5-.2.7-.1l1.5.6c.3.1.4.3.4.5v.5c0 .3 0 .6-.4.8-.5.3-1.2.5-1.9.4-2.6-.4-4.7-2.5-5.1-5.1-.1-.7.1-1.4.4-1.9z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * A short card that offers a chat: what it is for, the button, and when it is
 * answered. Renders nothing without a team number, so the page never promises
 * a chat it cannot open.
 */
export function ChatCard({
  title,
  body,
  intent,
  cta,
  className,
}: {
  title: string;
  body: string;
  intent: ChatIntent;
  cta: string;
  className?: string;
}) {
  const contact = useWhatsappContact();
  if (!contact) return null;

  return (
    <section aria-label={title} className={cn("k-hard-sm rounded-[12px] bg-white p-4 tablet:p-5", className)}>
      <h2 className="text-[15.5px] font-bold text-ink">{title}</h2>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{body}</p>
      <ChatLink intent={intent} className="mt-3 w-full tablet:w-auto">
        {cta}
      </ChatLink>
      <ChatHoursNote className="mt-2" />
    </section>
  );
}
