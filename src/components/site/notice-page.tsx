import * as React from "react";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export interface NoticePageProps {
  eyebrow: string;
  title: string;
  description: string;
  /** The way out: a link back, or a button that retries. */
  children?: React.ReactNode;
}

/**
 * The shape the three boundary pages share — not found, error, forbidden.
 *
 * They sit outside the customer layout, so they get no header, no navigation and
 * no footer, and each one used to be a centred emoji above a sentence. That is
 * the most template-looking thing in an app, and it lands on the one screen where
 * somebody is already annoyed.
 *
 * So a boundary gets the brand's best surface instead: the dark field, the brand
 * mark, and one clear way out. It carries no data of its own on purpose — `error`
 * may well be rendering *because* the database is unreachable, and a heading that
 * needs a query would fail with it.
 */
export function NoticePage({ eyebrow, title, description, children }: NoticePageProps) {
  return (
    <div className="band-dark flex min-h-[100dvh] items-center">
      <div className="band-inner-narrow py-16">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-pink" aria-hidden="true" />
          <span className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
            {BRAND_NAME}
          </span>
        </Link>

        <p className="eyebrow mt-12 text-pink">{eyebrow}</p>
        <h1 className="display-2 mt-3 text-white">{title}</h1>
        <p className="lede mt-4 text-white/70">{description}</p>

        {children && <div className="mt-9 flex flex-wrap gap-2.5">{children}</div>}
      </div>
    </div>
  );
}
