import * as React from "react";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { getSiteTexts } from "@/lib/queries/site.query";
import { getSettings } from "@/lib/services/setting.service";
import { getSiteEditContext } from "@/lib/site-edit";
import { PublicNav } from "@/components/nav/public-nav";
import { EditModeBar } from "@/components/site/edit-mode";
import { SiteFooter } from "@/components/site/site-footer";
import { AccentRoot } from "@/components/site/accent-root";
import { AccentSwitch } from "@/components/site/accent-switch";
import { ACCENT_COOKIE, isAutomatedAgent, parseAccent } from "@/lib/accent";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The footer carries the business's identity on every customer page, so the
  // layout needs the profile text and the store's number. Both are small reads
  // and the session check below is a cookie decode, not a query.
  const [{ isAdmin, editing, name }, texts, settings, jar, requestHeaders] = await Promise.all([
    getSiteEditContext(),
    getSiteTexts(),
    getSettings(),
    cookies(),
    headers(),
  ]);

  // The colour mood is read here, and only here, so the staff screens never
  // take it on — see `src/lib/accent.ts`. No cookie means the visitor has not
  // been asked yet; a crawler is never asked, or it would index the question.
  const accent = parseAccent(jar.get(ACCENT_COOKIE)?.value);
  const ask = accent === null && !isAutomatedAgent(requestHeaders.get("user-agent"));

  return (
    <AccentRoot
      initialAccent={accent}
      ask={ask}
      brandName={texts["hero.title"].value}
      className="min-h-screen flex flex-col bg-cream"
    >
      {/* Only ever rendered for a signed-in ADMIN. The switch it holds is a
          cookie, which decides nothing on its own — see `site-edit.ts`. */}
      {isAdmin && <EditModeBar editing={editing} name={name} />}

      {/* Header */}
      <header className="bg-white border-b-[1.5px] border-line sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex flex-col justify-center min-w-0">
            <Link href="/" className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-pink rounded-full" aria-hidden="true" />
              {/*
                A span, not a heading. This is the site's banner logo on every
                customer page, and every one of those pages already has its own
                <h1> — the catalogue's greeting, the tracker's title, the
                profile's hero. Marking the logo up as one too gave each page two
                first-level headings, which leaves someone navigating by heading
                unable to tell where the page's own content starts.
              */}
              <span className="font-display font-semibold text-xl text-pink-deep">
                {texts["hero.title"].value}
              </span>
            </Link>
            <p className="text-[11px] text-ink-soft hidden sm:block mt-0.5">
              {texts["footer.tagline"].value}
            </p>
          </div>

          <AccentSwitch />
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

      <SiteFooter texts={texts} whatsapp={settings.adminWhatsapp} editing={editing} />
    </AccentRoot>
  );
}
