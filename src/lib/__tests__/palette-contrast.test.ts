import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The palette's contrast guarantee, checked against the real stylesheet.
 *
 * Every pair below is one that actually appears on a screen in this app. The
 * tokens are read out of `globals.css` rather than copied here, so retuning a
 * colour for looks and dropping it below the threshold fails this test instead
 * of shipping — which is how the palette regressed in the first place.
 *
 * WCAG 2.1 AA: 4.5:1 for body text, 3:1 for large text and for the
 * non-text things that carry meaning, such as the focus ring.
 */
const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf-8");

/**
 * A token's value, which must be a literal hex.
 *
 * Not a `var()` alias, however much tidier a `--brand-*` layer would read.
 * Tailwind v4 can only bake an opacity modifier into a colour it can resolve
 * statically: `bg-warn-soft/70` becomes `#fff0d9b3`, but the same class on an
 * aliased token emits the fully opaque colour and says nothing. That silently
 * turned the sheet's scrim and the stepper's disabled state solid. The check
 * below is what keeps the indirection out.
 */
function token(name: string): string {
  const declared = CSS.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  if (!declared) throw new Error(`--color-${name} is not defined in globals.css`);

  const value = declared[1]!.trim();
  const hex = value.match(/^#([0-9A-Fa-f]{6})$/);
  if (!hex) {
    throw new Error(
      `--color-${name} is "${value}". Colour tokens must be literal hex — see the ` +
        `note in globals.css about opacity modifiers and var() aliases.`,
    );
  }

  return hex[1]!.toUpperCase();
}

function relativeLuminance(hex: string): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE = "FFFFFF";

/** [foreground, background, minimum ratio, where it appears] */
const PAIRS: readonly [string, string, number, string][] = [
  // Body text. All of these are 11–15px, so none of them qualifies as large.
  ["ink", "cream", 4.5, "teks utama di latar halaman"],
  ["ink", "white", 4.5, "teks utama di dalam kartu"],
  ["ink-soft", "cream", 4.5, "teks sekunder di latar halaman"],
  ["ink-soft", "white", 4.5, "subteks di dalam kartu"],
  ["ink-soft", "pink-soft", 4.5, "subteks di kartu yang disorot"],
  ["pink-deep", "white", 4.5, "aksen dan angka di dalam kartu"],
  ["pink-deep", "cream", 4.5, "label peran di header staf"],
  ["pink-deep", "pink-soft", 4.5, "angka 'Uang masuk' di dashboard"],
  ["sky-deep", "sky-soft", 4.5, "Badge info"],
  // The cross-area shortcuts in the navigation. They are sky rather than pink so
  // that "another actor's screen" reads at a glance, which puts sky-deep on text
  // duty at 10px — the 3:1 the focus ring needs is not enough for that.
  ["sky-deep", "white", 4.5, "pintasan lintas-area di navigasi"],
  ["ok", "ok-soft", 4.5, "Badge ok"],
  ["warn", "warn-soft", 4.5, "Badge prep"],
  ["hot", "hot-soft", 4.5, "Badge danger dan peringatan stok"],
  ["hot", "white", 4.5, "pesan error di bawah field"],

  // Text on a filled control.
  ["#" + WHITE, "pink-deep", 4.5, "Button primary, chip aktif, tab aktif"],
  ["#" + WHITE, "ok", 4.5, "Button done"],
  ["#" + WHITE, "warn", 4.5, "Button go"],
  ["#" + WHITE, "ink", 4.5, "Toast"],
  ["#" + WHITE, "sky-deep", 4.5, "pintasan lintas-area yang sedang aktif"],

  // The profile's dark band. This is where the brand fill finally gets to carry
  // text: #F875AA is barred from it on every light surface, and reaches 6.58:1
  // here — so on a dark band pink is the accent text colour and pink-deep is not
  // needed at all.
  ["#" + WHITE, "ink-deep", 4.5, "teks utama di band gelap"],
  ["pink", "ink-deep", 4.5, "eyebrow dan aksen di band gelap"],
  ["pink-soft", "ink-deep", 4.5, "hover tombol putih di band gelap"],

  // The profile's quiet band.
  ["ink", "sand", 4.5, "judul dan isi di band sand"],
  ["ink-soft", "sand", 4.5, "subteks di band sand"],
  ["pink-deep", "sand", 4.5, "eyebrow dan nomor bagian di band sand"],

  // Non-text, but it carries meaning: 3:1 under WCAG 1.4.11.
  ["sky-deep", "white", 3, "cincin fokus di atas kartu"],
  ["sky-deep", "cream", 3, "cincin fokus di atas halaman"],
  ["sky-deep", "sand", 3, "cincin fokus di atas band sand"],
  /*
   * The dark band swaps the ring to the lighter sky. sky-deep manages only
   * 3.06:1 against ink-deep — technically passing, with nothing left for a
   * rounding error — while sky reaches 11.88:1. `.band-dark` in globals.css sets
   * `--focus-ring` to make that swap, and this pair is what keeps it honest.
   */
  ["sky", "ink-deep", 3, "cincin fokus di atas band gelap"],
];

/**
 * `white` is Tailwind's own colour, not one of this project's tokens, so it has
 * no `--color-white` to read; everything else comes out of the stylesheet.
 */
function resolvePair(name: string): string {
  if (name.startsWith("#")) return name.slice(1).toUpperCase();
  if (name === "white") return WHITE;
  return token(name);
}

describe("palette contrast", () => {
  it.each(PAIRS)("%s on %s reaches %s:1 — %s", (fg, bg, minimum, where) => {
    const ratio = contrastRatio(resolvePair(fg), resolvePair(bg));

    expect(
      ratio,
      `${fg} on ${bg} is ${ratio.toFixed(2)}:1, below the ${minimum}:1 needed for ${where}`,
    ).toBeGreaterThanOrEqual(minimum);
  });

  it("keeps the brand pink off text, because it cannot carry any", () => {
    // #F875AA is the brand fill from conventions.md and stays exactly as
    // specified — but white on it is 2.59:1 and ink on it is 4.79:1, so it is
    // for bars, dots and chart columns only. Anything with a label uses
    // pink-deep. This test records why, so nobody "fixes" the button back.
    expect(contrastRatio(WHITE, token("pink"))).toBeLessThan(4.5);
  });

  it("keeps the primary button readable while the pointer is on it", () => {
    // The hover is `brightness-110`, which lightens the fill.
    const lighten = (hex: string, factor: number) =>
      [0, 2, 4]
        .map((i) => Math.min(255, Math.round(Number.parseInt(hex.slice(i, i + 2), 16) * factor)))
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();

    expect(contrastRatio(WHITE, lighten(token("pink-deep"), 1.1))).toBeGreaterThanOrEqual(4.5);
  });
});

/**
 * Text on the dark band is white at reduced opacity — a *blend*, not a token
 * pair, so the table above cannot see it.
 *
 * These are the alphas the dark bands actually use. `text-white/45` was among
 * them until this check was written: it comes out at 4.41:1, which is under the
 * 4.5:1 an 11px eyebrow needs, and every one of those is now /55. Add an alpha
 * here before using a new one.
 */
const WHITE_ALPHAS_ON_DARK = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.85] as const;

/** The colour you actually see when `hex` is painted over `over` at `alpha`. */
function blendOver(hex: string, over: string, alpha: number): string {
  return [0, 2, 4]
    .map((i) => {
      const top = Number.parseInt(hex.slice(i, i + 2), 16);
      const bottom = Number.parseInt(over.slice(i, i + 2), 16);
      return Math.round(top * alpha + bottom * (1 - alpha));
    })
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

describe("faded white text on the dark band", () => {
  it.each(WHITE_ALPHAS_ON_DARK)("white at %s over ink-deep still reads", (alpha) => {
    const ink = token("ink-deep");
    const ratio = contrastRatio(blendOver(WHITE, ink, alpha), ink);

    expect(ratio, `white/${alpha * 100} on ink-deep is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("records why 45% is not on that list", () => {
    const ink = token("ink-deep");

    expect(contrastRatio(blendOver(WHITE, ink, 0.45), ink)).toBeLessThan(4.5);
  });

  it("keeps the hero's outlined button visible as a control", () => {
    // Its border is the only thing delimiting it, so WCAG 1.4.11 wants 3:1.
    // white/25 managed 2.26:1; the button uses white/40.
    const ink = token("ink-deep");

    expect(contrastRatio(blendOver(WHITE, ink, 0.4), ink)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(blendOver(WHITE, ink, 0.25), ink)).toBeLessThan(3);
  });
});

describe("focus ring", () => {
  it("is declared once, globally, and not left to each component", () => {
    // Every primitive used to set `focus:outline-none` and put nothing back,
    // which left the keyboard path invisible across the whole app.
    expect(CSS).toMatch(/:focus-visible\s*\{/);
    expect(CSS).toContain("outline-offset");
  });
});

describe("colour tokens stay resolvable", () => {
  /**
   * Every `--color-*` must be a literal hex.
   *
   * This is not pedantry about style. Tailwind v4 bakes `/70` into the colour at
   * build time, which it can only do for a value it can resolve statically; point
   * a token at `var(--something)` and every opacity modifier on it silently
   * becomes fully opaque. It happened: the sheet's `bg-ink/40` scrim turned into
   * a solid wall and the stepper's `text-ink-soft/40` disabled state started
   * looking enabled, with nothing in the build to say so.
   */
  it("declares every colour as hex, never as a var() alias", () => {
    const declarations = [...CSS.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)];

    expect(declarations.length).toBeGreaterThan(10);

    for (const [, name, value] of declarations) {
      expect(
        value!.trim(),
        `--color-${name} must be a literal hex so opacity modifiers survive`,
      ).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
