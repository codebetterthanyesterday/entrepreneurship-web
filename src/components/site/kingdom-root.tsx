"use client";

import * as React from "react";

/** The attribute `globals.css` and `kingdom.css` answer to. */
export const KINGDOM_THEME = "kingdom";

export interface KingdomRootProps {
  className?: string;
  /**
   * Set on the staff side: "ADMIN", "KASIR" or "DAPUR". `staff.css` reads it
   * for the role colour on the header strip and the active tab, and for the
   * staff screens' own header and bar heights.
   */
  staffRole?: string;
  children: React.ReactNode;
}

/**
 * The Snack Kingdom theme, switched on.
 *
 * The theme is an attribute, `data-theme="kingdom"`, which `globals.css`
 * answers by redefining the palette's variables and `kingdom.css` by
 * reshaping the controls. It goes in two places:
 *
 *   - this wrapper, server-rendered, so the very first paint is already
 *     themed — there is no flash of the old palette before the page settles;
 *   - <html>, from a layout effect, so anything portalled into <body> (a
 *     sheet, the toast) follows as well.
 *
 * Both the customer layout and the staff layout render it; the staff one also
 * passes `staffRole`, which travels the same two places as `data-staff-role`.
 * The <html> copies are removed when this unmounts, so moving between the two
 * sides in one tab never leaves the other side's attributes behind.
 */
export function KingdomRoot({ className, staffRole, children }: KingdomRootProps) {
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = KINGDOM_THEME;
    if (staffRole) root.dataset.staffRole = staffRole;
    return () => {
      delete root.dataset.theme;
      delete root.dataset.staffRole;
    };
  }, [staffRole]);

  return (
    <div data-theme={KINGDOM_THEME} data-staff-role={staffRole} className={className}>
      {children}
    </div>
  );
}
