import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeadProps {
  /** The yellow slip above the title: "Stage report", "Quest log", … */
  tag: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  /** Buttons or counters on the right, wrapping under the title on a phone. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The top of every staff screen: a tag in the game's voice, the screen's name
 * as a heavy uppercase title, and one line saying what it is for.
 *
 * The tag is decoration — the title is the heading — so a screen reader hears
 * the screen's real name first.
 */
export function PageHead({ tag, title, lede, actions, className }: PageHeadProps) {
  return (
    <div className={cn("s-phead", className)}>
      <div className="min-w-0">
        <span className="k-tag k-tag-yellow" aria-hidden="true">
          {tag}
        </span>
        <h1 className="s-h1">{title}</h1>
        {lede && <p className="s-lede">{lede}</p>}
      </div>
      {actions && <div className="s-phead-actions">{actions}</div>}
    </div>
  );
}
