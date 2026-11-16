import * as React from "react";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { getSiteIdentity } from "@/lib/queries/site.query";
import { getSettings } from "@/lib/services/setting.service";
import { PublicNav } from "@/components/nav/public-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { BrandMark } from "@/components/site/brand-mark";
import { AccentRoot } from "@/components/site/accent-root";
import { AccentSwitch } from "@/components/site/accent-switch";
import { ACCENT_COOKIE, parseAccent, shouldAskAccent } from "@/lib/accent";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The header and footer name the business on every customer page, so the
  // layout needs its name, tagline and contact. Both are small reads.
  const [identity, settings, jar, requestHeaders] = await Promise.all([
    getSiteIdentity(),
    getSettings(),
    cookies(),
    headers(),
  ]);

  // The colour mood is read here, and only here, so the staff screens never
  // take it on — see `src/lib/accent.ts`. No cookie means the visitor has not
  // been asked yet; a crawler is never asked, or it would index the question.
  // The admin can switch the whole feature off: a visitor who already answered
  // keeps their mood, but nobody new is asked and the header switch goes away.
  const accentChoice = settings.accentChoiceEnabled;
  const accent = parseAccent(jar.get(ACCENT_COOKIE)?.value);
  const ask = shouldAskAccent({
    enabled: accentChoice,
    accent,
    userAgent: requestHeaders.get("user-agent"),
  });

  return (
    <AccentRoot
      initialAccent={accent}
      ask={ask}
      brandName={identity.brandName}
      className="min-h-screen flex flex-col bg-cream"
    >
      {/* Header */}
      <header className="bg-white border-b-[1.5px] border-line sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex flex-col justify-center min-w-0">
            <Link href="/" className="flex min-h-[44px] items-center gap-2">
              <BrandMark className="w-10" />
              {/*
                A span, not a heading. This is the site's banner logo on every
                customer page, and every one of those pages already has its own
                <h1> — the catalogue's greeting, the tracker's title. Marking the logo up as one too gave each page two
                first-level headings, which leaves someone navigating by heading
                unable to tell where the page's own content starts.
              */}
              <span className="font-display font-semibold text-xl text-pink-deep">
                {identity.brandName}
              </span>
            </Link>
            <p className="text-[11px] text-ink-soft hidden sm:block mt-0.5">
              {identity.tagline}
            </p>
          </div>

          {accentChoice && <AccentSwitch />}
        </div>
      </header>

      {/*
        Tracking used to be a lone button in the header; it is one of the four
        stops in the navigation now, so the header is left to the brand. A sibling
        of the header rather than a child, because on a phone the bar is
        `position: fixed` and nesting that inside a `position: sticky` ancestor is
        a shape WebKit has historically got wrong.
      */}
      <PublicNav />

      {/*
        No measure and no padding here on purpose: every customer page is built
        from full-bleed bands now, and a band has to be able to reach the edge of
        the screen. Each page supplies its own inner measure through `.band-inner`.
      */}
      <main className="flex-1 w-full">{children}</main>

      <SiteFooter identity={identity} whatsapp={settings.adminWhatsapp} />
    </AccentRoot>
  );
}
