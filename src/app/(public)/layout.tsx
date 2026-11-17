import * as React from "react";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { getSiteIdentity } from "@/lib/queries/site.query";
import { getSettings } from "@/lib/services/setting.service";
import { HeaderBag, PublicNav } from "@/components/nav/public-nav";
import { WorldSteps } from "@/components/nav/world-steps";
import { SiteFooter } from "@/components/site/site-footer";
import { KingdomRoot } from "@/components/site/kingdom-root";
import { SplashScreen } from "@/components/site/splash-screen";
import { SPLASH_COOKIE, shouldShowSplash } from "@/lib/splash";
import "./kingdom.css";

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

  // The splash plays once per browser session. Deciding here, from the cookie,
  // means a visitor who has seen it gets HTML without it — nothing to flash
  // before a script could hide it.
  const showSplash = shouldShowSplash({
    seen: jar.has(SPLASH_COOKIE),
    userAgent: requestHeaders.get("user-agent"),
  });

  return (
    // `KingdomRoot` is what makes these pages the Snack Kingdom: it sets
    // `data-theme="kingdom"`, which `globals.css` and `kingdom.css` answer. The
    // staff layout does not render it, so /admin, /kasir and /dapur keep the
    // base palette.
    <KingdomRoot className="min-h-screen flex flex-col bg-cream">
      {showSplash && <SplashScreen brandName={identity.brandName} tagline={identity.tagline} />}

      {/* Header */}
      <header className="bg-white border-b-2 border-line sticky top-0 z-40">
        <div className="band-inner h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex min-h-[44px] flex-col justify-center min-w-0">
            {/*
              A span, not a heading. This is the site's banner logo on every
              customer page, and every one of those pages already has its own
              <h1>. Marking the logo up as one too gave each page two first-level
              headings, which leaves someone navigating by heading unable to tell
              where the page's own content starts.
            */}
            <span className="k-logo-name">{identity.brandName}</span>
            <span className="k-logo-tagline truncate">{identity.tagline}</span>
          </Link>

          <HeaderBag />
        </div>
      </header>

      {/*
        A sibling of the header rather than a child, because on a phone the bar
        is `position: fixed` and nesting that inside a `position: sticky`
        ancestor is a shape WebKit has historically got wrong. From 640px up it
        is laid over the header's middle — see `.k-nav` in `kingdom.css`.
      */}
      <PublicNav />

      <WorldSteps />

      {/*
        No measure and no padding here on purpose: every customer page is built
        from full-bleed bands, and a band has to be able to reach the edge of
        the screen. Each page supplies its own inner measure through `.band-inner`.
      */}
      <main className="flex-1 w-full">{children}</main>

      <SiteFooter identity={identity} whatsapp={settings.adminWhatsapp} />
    </KingdomRoot>
  );
}
