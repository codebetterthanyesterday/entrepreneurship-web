import * as React from "react";
import { getActiveProducts } from "@/lib/queries/product.query";
import { getSiteLists, getSiteTexts } from "@/lib/queries/site.query";
import { getSettings } from "@/lib/services/setting.service";
import { getSiteEditContext } from "@/lib/site-edit";
import { ButtonLink } from "@/components/ui/button";
import { EditableText } from "@/components/site/editable-text";
import { SiteListSection } from "@/components/site/site-list-section";
import { ProfileMenuList, type MenuListProduct } from "@/components/site/profile-menu-list";
import { Reveal, RevealNoScript } from "@/components/site/reveal";
import { toWhatsappUrl } from "@/lib/utils";
import { pageTitle } from "@/lib/brand";
import type { SiteTexts } from "@/lib/queries/site.query";

export const metadata = {
  title: pageTitle(),
  description: "Profil usaha: cerita, menu, tim, jadwal dan kontak.",
};

// The profile text is editable while the page is live, the booth switches move
// during the event, and none of it is read through `fetch` — so Next has no
// signal that this is dynamic and would otherwise serve whatever was true at
// build time. Same reason as every other page in this app.
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  // `getSiteEditContext` decides this from the session, never from the cookie
  // alone — the cookie only picks which view an admin asked for.
  const [{ editing }, texts, lists, products, settings] = await Promise.all([
    getSiteEditContext(),
    getSiteTexts(),
    getSiteLists(),
    getActiveProducts(),
    getSettings(),
  ]);

  // Plain values only — Prisma rows carry Temporal instants that cannot cross
  // the server/client boundary.
  const menu: MenuListProduct[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    categoryName: product.category?.name ?? null,
  }));

  const whatsappUrl = toWhatsappUrl(settings.adminWhatsapp);

  // A list nobody has filled in yet is absent for a customer and present for an
  // editing admin, who needs somewhere to add the first item.
  const showTeam = editing || lists.team.length > 0;
  const showGallery = editing || lists.gallery.length > 0;

  return (
    <>
      <RevealNoScript />

      {/*
        The page is a sequence of full-width bands — dark, cream, sand — rather
        than a stack of cards on one background. The alternation is what makes
        scrolling feel like moving between rooms, and it is the whole reason
        `main` gave up its own measure.
      */}

      {/* ---------------------------------------------------------- hero ---- */}
      <section className="band band-dark band-glow">
        <div className="band-inner">
          <Reveal className="max-w-[52rem]">
            <p className="eyebrow text-pink">
              Market Day &middot; buatan sendiri
            </p>

            <EditableText
              textKey="hero.title"
              value={texts["hero.title"].value}
              version={texts["hero.title"].version}
              editing={editing}
              as="h1"
              className="display-1 mt-5 text-white"
            />

            <span className="rule mt-7 text-pink" aria-hidden="true" />

            <EditableText
              textKey="hero.tagline"
              value={texts["hero.tagline"].value}
              version={texts["hero.tagline"].version}
              editing={editing}
              className="lede mt-6 text-white/75"
            />

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink href="/menu" className="bg-white text-ink-deep hover:bg-pink-soft">
                {texts["hero.ctaLabel"].value}
              </ButtonLink>

              {whatsappUrl && (
                <ButtonLink
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-transparent border-2 border-white/40 text-white hover:bg-white/10"
                >
                  Tanya dulu
                </ButtonLink>
              )}
            </div>

            {/* Real state, not decoration: whether preorder is actually open is
                the first thing someone landing here wants to know. */}
            <p className="mt-9 flex items-center gap-2.5 text-[13px] text-white/70">
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-full flex-none ${
                  settings.preorderOpen ? "bg-ok-soft" : "bg-white/35"
                }`}
              />
              {settings.preorderOpen ? "Preorder sedang buka" : "Preorder sedang tutup"}
            </p>

            {editing && (
              <div className="mt-8 max-w-sm">
                <p className="eyebrow text-white/50 mb-1.5">Teks tombol</p>
                <EditableText
                  textKey="hero.ctaLabel"
                  value={texts["hero.ctaLabel"].value}
                  version={texts["hero.ctaLabel"].version}
                  editing={editing}
                  className="text-[13px] text-white/75"
                />
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------- story ---- */}
      <section className="band band-cream">
        <div className="band-inner">
          {/*
            Asymmetric on a wide screen: the heading sits in a narrow column and
            stays put while the prose scrolls past it. On a phone it is simply
            one column, heading first.
          */}
          <div className="grid gap-8 desktop:grid-cols-[14rem_1fr] desktop:gap-16">
            <Reveal className="desktop:sticky desktop:top-[calc(var(--page-top)+3rem)] desktop:self-start">
              <p className="eyebrow text-pink-deep">01</p>
              <SectionHeading
                textKey="story.heading"
                texts={texts}
                editing={editing}
                className="mt-3 text-ink"
              />
            </Reveal>

            <Reveal delayMs={80}>
              <EditableText
                textKey="story.body"
                value={texts["story.body"].value}
                version={texts["story.body"].version}
                editing={editing}
                as="div"
                className="story-prose text-ink"
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- advantages ---- */}
      <section className="band band-sand">
        <div className="band-inner">
          <Reveal className="max-w-[34rem]">
            <p className="eyebrow text-pink-deep">02</p>
            <SectionHeading
              textKey="advantages.heading"
              texts={texts}
              editing={editing}
              className="mt-3 text-ink"
            />
          </Reveal>

          <Reveal delayMs={80} className="mt-10">
            <SiteListSection section="advantage" items={lists.advantage} editing={editing} />
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------- menu ---- */}
      <section className="band band-cream">
        <div className="band-inner">
          <Reveal className="flex flex-col gap-3 desktop:flex-row desktop:items-end desktop:justify-between">
            <div className="max-w-[34rem]">
              <p className="eyebrow text-pink-deep">03</p>
              <SectionHeading
                textKey="menu.heading"
                texts={texts}
                editing={editing}
                className="mt-3 text-ink"
              />
              <EditableText
                textKey="menu.note"
                value={texts["menu.note"].value}
                version={texts["menu.note"].version}
                editing={editing}
                className="mt-4 text-[14px] text-ink-soft max-w-[44ch]"
              />
            </div>

            <ButtonLink href="/menu" variant="ghost" size="sm" className="flex-none self-start">
              Buka menu lengkap
            </ButtonLink>
          </Reveal>

          <Reveal delayMs={80} className="mt-10">
            <ProfileMenuList products={menu} />
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------- team ---- */}
      {showTeam && (
        <section className="band band-sand">
          <div className="band-inner">
            <Reveal className="max-w-[34rem]">
              <p className="eyebrow text-pink-deep">04</p>
              <SectionHeading
                textKey="team.heading"
                texts={texts}
                editing={editing}
                className="mt-3 text-ink"
              />
            </Reveal>

            <Reveal delayMs={80} className="mt-10">
              <SiteListSection section="team" items={lists.team} editing={editing} />
            </Reveal>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------- gallery ---- */}
      {showGallery && (
        <section className="band band-tight band-cream">
          <div className="band-inner">
            <Reveal className="max-w-[34rem]">
              <p className="eyebrow text-pink-deep">05</p>
              <SectionHeading
                textKey="gallery.heading"
                texts={texts}
                editing={editing}
                className="mt-3 text-ink"
              />
            </Reveal>

            <Reveal delayMs={80} className="mt-8">
              <SiteListSection section="gallery" items={lists.gallery} editing={editing} />
            </Reveal>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------- contact ---- */}
      {/*
        The page closes on the dark field it opened with, and the footer directly
        below is dark too — so the bottom of every customer page is one
        continuous surface rather than a seam.
      */}
      <section className="band band-dark">
        <div className="band-inner">
          <Reveal className="grid gap-10 desktop:grid-cols-[1fr_1fr] desktop:gap-16">
            <div className="max-w-[34rem]">
              <p className="eyebrow text-pink">06</p>
              <SectionHeading
                textKey="contact.heading"
                texts={texts}
                editing={editing}
                className="mt-3 text-white"
              />

              {whatsappUrl && (
                <ButtonLink
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-7 bg-white text-ink-deep hover:bg-pink-soft"
                >
                  Chat {settings.adminWhatsapp}
                </ButtonLink>
              )}

              {editing && !whatsappUrl && (
                <p className="mt-6 text-[13px] text-white/60 italic max-w-[38ch]">
                  Nomor WhatsApp-nya diisi di Panel &rarr; Pengaturan, bukan di sini — biar cuma ada
                  satu nomor yang dipakai di seluruh aplikasi.
                </p>
              )}
            </div>

            {/* Two facts, set as a definition list with hairlines instead of two
                more bordered cards. */}
            <dl className="flex flex-col">
              <div className="border-t border-ink-line py-5">
                <dt className="eyebrow text-white/55">Jadwal</dt>
                <EditableText
                  textKey="contact.schedule"
                  value={texts["contact.schedule"].value}
                  version={texts["contact.schedule"].version}
                  editing={editing}
                  as="dd"
                  className="mt-2 text-[15px] leading-relaxed text-white/85"
                />
              </div>

              <div className="border-t border-ink-line py-5">
                <dt className="eyebrow text-white/55">Lokasi</dt>
                <EditableText
                  textKey="contact.location"
                  value={texts["contact.location"].value}
                  version={texts["contact.location"].version}
                  editing={editing}
                  as="dd"
                  className="mt-2 text-[15px] leading-relaxed text-white/85"
                />
              </div>
            </dl>
          </Reveal>
        </div>
      </section>
    </>
  );
}

/**
 * A section heading. Its own component only so the props every heading needs are
 * not written out eight times.
 */
function SectionHeading({
  textKey,
  texts,
  editing,
  className,
}: {
  textKey:
    | "story.heading"
    | "advantages.heading"
    | "menu.heading"
    | "team.heading"
    | "gallery.heading"
    | "contact.heading";
  texts: SiteTexts;
  editing: boolean;
  className?: string;
}) {
  return (
    <EditableText
      textKey={textKey}
      value={texts[textKey].value}
      version={texts[textKey].version}
      editing={editing}
      as="h2"
      className={`display-2 ${className ?? ""}`}
    />
  );
}
