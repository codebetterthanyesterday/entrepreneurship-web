import * as React from "react";
import Link from "next/link";
import { BrandMark } from "@/components/site/brand-mark";
import { whatsappChatUrl } from "@/lib/whatsapp";
import type { SiteIdentity } from "@/lib/queries/site.query";

export interface SiteFooterProps {
  identity: SiteIdentity;
  /** The business number, reused from store settings rather than stored twice. */
  whatsapp: string | null;
}

/** The four worlds, named the way the design's footer names them. */
const LINKS = [
  { href: "/", label: "World 1: Snack Menu" },
  { href: "/keranjang", label: "World 2: Item Inventory" },
  { href: "/checkout", label: "World 3: Adventurer Info" },
  { href: "/lacak", label: "World 4: Order Tracker" },
  { href: "/privasi", label: "Privasi & data kamu" },
];

/**
 * The business's name and contact at the bottom of every customer page, on the
 * strip of ground the design ends each page with.
 *
 * Kept short on purpose: the site is for ordering, so the footer is the way to
 * ask something (WhatsApp, Instagram) and the places to go, nothing more. The
 * contact details are the real ones from the admin's settings — the design's
 * placeholder e-mail and address are not carried over.
 */
export function SiteFooter({ identity, whatsapp }: SiteFooterProps) {
  const whatsappUrl = whatsappChatUrl(whatsapp);
  const { brandName, tagline, instagram } = identity;

  return (
    <footer>
      <div aria-hidden="true" className="k-ground" />

      <div className="band-dark text-white">
        <div className="band-inner grid gap-8 py-10 tablet:grid-cols-[2fr_1fr_1fr]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <BrandMark className="w-12 text-white" />
              <span className="font-[family-name:var(--font-display)] text-xl font-extrabold uppercase text-white">
                {brandName} Snacks
              </span>
            </div>
            {tagline && <p className="max-w-[26em] text-[14px] text-white/75">{tagline}</p>}
          </div>

          <nav aria-label="Navigasi footer" className="flex flex-col gap-1">
            <h2 className="eyebrow text-[13px] text-pink">World Navigation</h2>
            <ul className="flex flex-col">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center text-[14px] text-white/85 hover:text-pink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {(whatsappUrl || instagram.length > 0) && (
            <div className="flex flex-col gap-1">
              <h2 className="eyebrow text-[13px] text-pink">Snack Guild HQ</h2>

              <ul className="flex flex-col text-[14px] text-white/85">
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
              </ul>
            </div>
          )}
        </div>

        {/*
          The bottom strip also carries the clearance for the fixed bottom
          navigation, so the page ends in the footer's own colour instead of a
          bare spacer showing through. The variable is 0 from 640px up, where the
          bar has moved into the header.
        */}
        <div className="border-t border-ink-line pb-[var(--nav-bar-height)]">
          <p className="band-inner eyebrow flex flex-wrap justify-between gap-2 py-4 text-[10px] text-white/75">
            <span>
              Thanks for visiting the Snack Kingdom! &copy; {new Date().getFullYear()} {brandName}
            </span>
            <span className="text-pink">All hearts &amp; coins reserved</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
