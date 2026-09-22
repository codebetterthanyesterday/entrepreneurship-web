import * as React from "react";
import Link from "next/link";
import { EditableText } from "@/components/site/editable-text";
import { toWhatsappUrl } from "@/lib/utils";
import type { SiteTexts } from "@/lib/queries/site.query";

export interface SiteFooterProps {
  texts: SiteTexts;
  /** The business number, reused from store settings rather than stored twice. */
  whatsapp: string | null;
  editing: boolean;
}

const LINKS = [
  { href: "/", label: "Tentang" },
  { href: "/menu", label: "Menu" },
  { href: "/keranjang", label: "Keranjang" },
  { href: "/lacak", label: "Lacak pesanan" },
];

/**
 * The business's identity at the bottom of every customer page.
 *
 * Both reference templates put this here and the app had no footer at all, which
 * left the brand living only in a 64px header. Three columns rather than the
 * templates' four: there is no newsletter and no blog to link, and inventing
 * columns to fill a row is how a small business ends up looking like a stock
 * template.
 *
 * Dark, like the profile's closing band directly above it, so the bottom of the
 * page is one continuous surface rather than a seam. On the lighter pages — the
 * catalogue, the cart — it reads as the ordinary dark footer it is.
 *
 * A Server Component that embeds editable blocks — the editing itself is client
 * work, but nothing here needs to be.
 */
export function SiteFooter({ texts, whatsapp, editing }: SiteFooterProps) {
  const whatsappUrl = toWhatsappUrl(whatsapp);
  const instagram = texts["contact.instagram"].value.trim();

  return (
    <footer className="band-dark text-white">
      <div className="band-inner py-12 grid gap-9 tablet:grid-cols-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-pink rounded-full" aria-hidden="true" />
            <span className="font-[family-name:var(--font-display)] font-semibold text-lg text-white">
              {texts["hero.title"].value}
            </span>
          </div>

          <EditableText
            textKey="footer.tagline"
            value={texts["footer.tagline"].value}
            version={texts["footer.tagline"].version}
            editing={editing}
            className="text-[13px] leading-relaxed text-white/65 max-w-[34ch]"
          />
        </div>

        <nav aria-label="Navigasi footer" className="flex flex-col gap-2">
          <h2 className="eyebrow text-white/55">Jelajahi</h2>
          <ul className="flex flex-col">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center text-[13.5px] text-white/75 hover:text-pink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-2">
          <h2 className="eyebrow text-white/55">Kontak</h2>

          <ul className="flex flex-col text-[13.5px] text-white/75">
            {whatsappUrl ? (
              <li>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] min-w-[44px] items-center hover:text-pink"
                >
                  WhatsApp: {whatsapp}
                </a>
              </li>
            ) : (
              editing && (
                <li className="italic">
                  Nomor WhatsApp diisi di Panel &rarr; Pengaturan.
                </li>
              )
            )}

            {instagram.length > 0 && (
              <li>
                <a
                  href={`https://instagram.com/${instagram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] min-w-[44px] items-center hover:text-pink"
                >
                  Instagram: @{instagram.replace(/^@/, "")}
                </a>
              </li>
            )}
          </ul>

          {editing && (
            <EditableText
              textKey="contact.instagram"
              value={texts["contact.instagram"].value}
              version={texts["contact.instagram"].version}
              editing={editing}
              className="text-[13px] text-white/60"
              placeholder="Username Instagram, tanpa @"
            />
          )}
        </div>
      </div>

      {/*
        The bottom strip also carries the clearance for the fixed bottom
        navigation, so the page ends in the footer's own colour instead of a bare
        spacer showing through. The variable is 0 from 640px up, where the bar has
        moved into the header.
      */}
      <div className="border-t border-ink-line pb-[var(--nav-bar-height)]">
        <p className="band-inner py-4 text-[12px] text-white/55">
          &copy; {new Date().getFullYear()} {texts["hero.title"].value}
        </p>
      </div>
    </footer>
  );
}
