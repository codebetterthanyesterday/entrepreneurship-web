"use client";

import * as React from "react";

/** The attribute `globals.css` and `kingdom.css` answer to. */
export const KINGDOM_THEME = "kingdom";

export interface KingdomRootProps {
  className?: string;
  children: React.ReactNode;
}

/**
 * The customer side's theme, switched on.
 *
 * The theme is an attribute, `data-theme="kingdom"`, which `globals.css`
 * answers by redefining the palette's variables and `(public)/kingdom.css` by
 * reshaping the controls. It goes in two places:
 *
 *   - this wrapper, server-rendered, so the very first paint is already
 *     themed — there is no flash of the staff palette before the page settles;
 *   - <html>, from a layout effect, so anything portalled into <body> (the
 *     product sheet, the toast) follows as well.
 *
 * The <html> copy is removed when this unmounts. Only the public layout renders
 * `KingdomRoot`, so walking from the storefront into /admin or /kasir in the
 * same tab puts the staff screens back in their own palette.
 */
export function KingdomRoot({ className, children }: KingdomRootProps) {
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = KINGDOM_THEME;
    return () => {
      delete root.dataset.theme;
    };
  }, []);

  return (
    <div data-theme={KINGDOM_THEME} className={className}>
      {children}
    </div>
  );
}
