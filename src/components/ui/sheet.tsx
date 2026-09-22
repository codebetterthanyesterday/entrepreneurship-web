"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /**
   * Names the dialog for assistive technology when the sheet draws its own
   * heading instead of handing one to `title`.
   */
  ariaLabel?: string;
  children: React.ReactNode;
}

/**
 * "Are we past the server render yet?" — `createPortal` needs a real
 * `document`, so the sheet renders nothing until the browser has taken over.
 *
 * Reading it through `useSyncExternalStore` rather than flipping a flag in an
 * effect means the answer is already true on the first client render, so the
 * portal and the focus effect below land in the same commit instead of one
 * render apart.
 */
const NEVER_CHANGES = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function Sheet({ open, onClose, title, ariaLabel, children }: SheetProps) {
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const mounted = React.useSyncExternalStore(NEVER_CHANGES, onClient, onServer);

  React.useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        } else if (e.key === "Tab") {
          if (sheetRef.current) {
            const focusableElements = sheetRef.current.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements.length > 0) {
              const firstElement = focusableElements[0] as HTMLElement;
              const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

              if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                  lastElement.focus();
                  e.preventDefault();
                }
              } else {
                if (document.activeElement === lastElement) {
                  firstElement.focus();
                  e.preventDefault();
                }
              }
            }
          }
        }
      };
      
      document.addEventListener("keydown", handleKeyDown);
      
      // Auto-focus the sheet on open
      if (sheetRef.current) {
         sheetRef.current.focus();
      }

      return () => {
        document.body.style.overflow = "";
        document.removeEventListener("keydown", handleKeyDown);
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end desktop:justify-center desktop:items-center">
      {/* Scrim */}
      <div 
        className="absolute inset-0 bg-ink/40 animate-fade-in" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Sheet / Modal Content */}
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        className={cn(
          // The dialog itself is focused on open only to seed the focus trap; a ring
          // around the whole sheet would say "this panel is the control".
          "relative z-50 bg-white w-full flex flex-col focus:outline-none",
          // Mobile Bottom Sheet
          "rounded-t-[24px] pb-[max(16px,env(safe-area-inset-bottom))] max-h-[86vh]",
          "animate-slide-up",
          // Desktop Modal
          "desktop:w-[min(460px,92vw)] desktop:rounded-[22px] desktop:p-6 desktop:pb-6 desktop:max-h-[90vh]",
          "desktop:animate-modal-in desktop:rounded-t-[22px]"
        )}
      >
        {/* Grab Handle for mobile */}
        <div className="flex justify-center pt-3 pb-2 desktop:hidden" aria-hidden="true">
          <div className="w-12 h-1.5 bg-line rounded-full" />
        </div>
        
        {title && (
          <div className="px-4 pb-2 pt-2 desktop:px-0 desktop:pt-0">
            <h2 className="text-xl font-semibold text-ink">{title}</h2>
          </div>
        )}
        
        {/* Internal Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 desktop:px-0">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
