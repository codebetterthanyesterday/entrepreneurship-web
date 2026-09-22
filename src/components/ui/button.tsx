import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "ghost" | "flat" | "go" | "done";
export type ButtonSize = "sm" | "md";

export interface ButtonLook {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/**
 * The button's appearance, separated from the `<button>` element so that a
 * link can wear it too — see `ButtonLink` below.
 */
export function buttonClasses({ variant = "primary", size = "md", fullWidth }: ButtonLook): string {
  return cn(
    "inline-flex items-center justify-center rounded-xl font-medium transition-colors",
    // Sizes — 44px is the project's touch-target floor.
    size === "sm" && "min-h-[44px] px-4 text-sm",
    size === "md" && "min-h-[52px] px-6 text-base",
    fullWidth && "w-full",
    // Variants. pink-deep, not pink: white on #F875AA is 2.59:1 and fails even
    // the large-text threshold. The brand fill stays for decoration.
    variant === "primary" && "bg-pink-deep text-white hover:brightness-110",
    variant === "ghost" && "bg-white border-2 border-pink-soft text-pink-deep hover:bg-pink-soft",
    variant === "flat" && "bg-white border-[1.5px] border-line text-ink-soft hover:bg-cream",
    variant === "go" && "bg-warn text-white hover:brightness-95",
    variant === "done" && "bg-ok text-white hover:brightness-95",
  );
}

/**
 * Komponen Button digunakan untuk aksi utama pengguna (submit form, aksi async).
 *
 * For navigation, reach for `ButtonLink` instead: wrapping this in a `<Link>`
 * nests a `<button>` inside an `<a>`, which is invalid HTML, gives the keyboard
 * two stops for one control, and leaves a screen reader announcing both.
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonLook {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", fullWidth, isLoading, disabled, children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          buttonClasses({ variant, size, fullWidth }),
          (disabled || isLoading) &&
            "disabled:bg-line disabled:text-ink-soft disabled:border-none disabled:cursor-default",
          className,
        )}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin motion-reduce:animate-none -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export interface ButtonLinkProps
  extends React.ComponentPropsWithoutRef<typeof Link>,
    ButtonLook {}

/**
 * A link that looks like a button: one element, one tab stop, announced as the
 * link it actually is.
 */
const ButtonLink = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ className, variant = "primary", size = "md", fullWidth, children, ...props }, ref) => {
    return (
      <Link
        ref={ref}
        className={cn(buttonClasses({ variant, size, fullWidth }), className)}
        {...props}
      >
        {children}
      </Link>
    );
  },
);
ButtonLink.displayName = "ButtonLink";

export { Button, ButtonLink };
