import { BrandMark } from "@/components/site/brand-mark";
import * as React from "react";
import Link from "next/link";
import { toWhatsappUrl } from "@/lib/utils";
import type { SiteIdentity } from "@/lib/queries/site.query";

export interface SiteFooterProps {
  identity: SiteIdentity;
  /** The business number, reused from store settings rather than stored twice. */
  whatsapp: string | null;
}

const LINKS = [
  { href: "/", label: "Menu" },
  { href: "/keranjang", label: "Keranjang" },
  { href: "/lacak", label: "Lacak pesanan" },
];

/**
 * The business's name and contact at the bottom of every customer page.
 *
 * Kept short on purpose: the site is for ordering, so the footer is the way to
 * ask something (WhatsApp, Instagram) and the three places to go, nothing more.
 */
export function SiteFooter({ identity, whatsapp }: SiteFooterProps) {
  const whatsappUrl = toWhatsappUrl(whatsapp);
  const { brandName, instagram } = identity;

  return (
    <footer className="band-dark text-white">
      <div className="band-inner py-12 grid gap-9 tablet:grid-cols-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <BrandMark className="w-14 text-pink" />
            <span className="font-[family-name:var(--font-display)] font-semibold text-lg text-white">
              {brandName}
            </span>
          </div>
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

        {(whatsappUrl || instagram.length > 0) && (
        <div className="flex flex-col gap-2">
          <h2 className="eyebrow text-white/55">Kontak</h2>

          <ul className="flex flex-col text-[13.5px] text-white/75">
            {whatsappUrl && (
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
            )}

            {instagram.length > 0 && (
              <li>
                <a
                  href={`https://instagram.com/${instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] min-w-[44px] items-center hover:text-pink"
                >
                  Instagram: @{instagram}
                </a>
              </li>
            )}
          </ul>
        </div>
        )}
      </div>

      {/*
        The bottom strip also carries the clearance for the fixed bottom
        navigation, so the page ends in the footer's own colour instead of a bare
        spacer showing through. The variable is 0 from 640px up, where the bar has
        moved into the header.
      */}
      <div className="border-t border-ink-line pb-[var(--nav-bar-height)]">
        <p className="band-inner py-4 text-[12px] text-white/55">
          &copy; {new Date().getFullYear()} {brandName}
        </p>
      </div>
    </footer>
  );
}
