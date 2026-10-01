import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  /**
   * Sets the size (a width, e.g. `w-11`) and the colour (a text colour — the
   * mark is painted in `currentColor`).
   */
  className?: string;
  /**
   * Read out as the brand name. Leave it off where the name is already written
   * next to the mark, so a screen reader does not say it twice.
   */
  label?: string;
}

/**
 * The logo: the heart with the script wordmark across it.
 *
 * It is drawn as a mask, not as an image. The file holds only the logo's red as
 * an alpha shape; the wordmark's outline is left as a hole. So whatever surface
 * the mark sits on shows through the outline — white in the header, beige on a
 * sand band, espresso on the dark one — and the logo never arrives with a
 * rectangle of its own cream around it. That is the whole of "seamless" here.
 *
 * The colour comes from `currentColor`, which is what lets one file serve the
 * light surfaces (`text-pink-deep`, the brand red exactly) and the dark band
 * (`text-pink`, the cut of it that still reads there).
 */
export function BrandMark({ className, label }: BrandMarkProps) {
  return (
    <span
      className={cn("brand-mark text-pink-deep", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}
