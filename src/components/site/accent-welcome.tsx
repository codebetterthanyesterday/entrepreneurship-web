"use client";

import * as React from "react";
import type { Accent } from "@/lib/accent";

interface AccentWelcomeProps {
  brandName: string;
  onChoose: (accent: Accent, origin?: Element | null) => void;
}

/**
 * The first-visit question: "Perempuan atau laki-laki?", answered with a tap.
 *
 * It lives in `AccentRoot` and is server-rendered, so it is the first thing on
 * screen rather than something that drops over a page already being read. On a
 * phone it floats at the bottom, where a thumb already is; from a tablet up it
 * sits in the middle.
 *
 * Skipping is always one tap away and counts as an answer — the default pink —
 * so a visitor who would rather not say is never asked twice. Escape skips too.
 */
export function AccentWelcome({ brandName, onChoose }: AccentWelcomeProps) {
  const [lean, setLean] = React.useState<Accent | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const headingId = React.useId();
  const descriptionId = React.useId();

  // Focus the dialog itself so a screen reader announces the question; the page
  // behind is inert by now, so Tab can only move between the answers.
  React.useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onChoose("pink");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onChoose]);

  return (
    <div className="accent-welcome">
      {/* Without JavaScript nobody can answer, so nobody is asked. */}
      <noscript>
        <style>{`.accent-welcome{display:none}html:has(.accent-welcome){overflow:visible}`}</style>
      </noscript>

      <div className="flex min-h-full flex-col items-center justify-end px-3 pt-10 pb-[max(12px,env(safe-area-inset-bottom))] tablet:justify-center tablet:p-8">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          data-lean={lean ?? undefined}
          className="accent-welcome-panel w-full max-w-[27rem] px-5 pt-7 pb-4 tablet:px-7 tablet:pt-9 tablet:pb-5"
        >
          <span className="accent-welcome-light" data-side="pink" aria-hidden="true" />
          <span className="accent-welcome-light" data-side="blue" data-accent="blue" aria-hidden="true" />

          <p className="eyebrow accent-welcome-stagger truncate text-pink" style={stagger(0)}>
            Selamat datang di {brandName}
          </p>

          <h2
            id={headingId}
            className="display-2 accent-welcome-stagger mt-4 text-white"
            style={stagger(1)}
          >
            Hai! Kamu cewek atau cowok?
          </h2>

          <p
            id={descriptionId}
            className="accent-welcome-stagger mt-3 text-[14px] leading-relaxed text-white/70"
            style={stagger(2)}
          >
            Jawabanmu cuma dipakai buat milih nuansa warna halaman, dan nggak dikirim ke{" "}
            <span className="whitespace-nowrap">mana-mana.</span>
          </p>

          <div className="accent-welcome-stagger relative mt-5 grid grid-cols-2 gap-3 min-[380px]:mt-7" style={stagger(3)}>
            <Choice
              accent="pink"
              label="Perempuan"
              mood="Nuansa pink"
              onChoose={onChoose}
              onLean={setLean}
            />
            <Choice
              accent="blue"
              label="Laki-laki"
              mood="Nuansa biru"
              onChoose={onChoose}
              onLean={setLean}
            />

            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[42%] grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-ink-line bg-ink-deep text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70"
            >
              atau
            </span>
          </div>

          <div
            className="accent-welcome-stagger mt-4 flex items-center justify-between gap-4"
            style={stagger(4)}
          >
            <p className="text-[12px] leading-snug text-white/55">
              Bisa diganti kapan aja lewat tombol warna di pojok atas.
            </p>
            <button
              type="button"
              onClick={() => onChoose("pink")}
              className="min-h-[44px] flex-none px-2 text-[13px] font-semibold text-white/75 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white hover:decoration-white/70"
            >
              Lewati
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function stagger(index: number): React.CSSProperties {
  return { "--i": index } as React.CSSProperties;
}

interface ChoiceProps {
  accent: Accent;
  label: string;
  mood: string;
  onChoose: (accent: Accent, origin?: Element | null) => void;
  onLean: (accent: Accent | null) => void;
}

/**
 * One answer. The blue one is the pink one wrapped in `data-accent="blue"` — the
 * orb, the dot and the hover border all read the palette's variables, so the
 * choice shows the mood it picks without carrying a colour of its own.
 */
function Choice({ accent, label, mood, onChoose, onLean }: ChoiceProps) {
  return (
    <button
      type="button"
      data-accent={accent === "blue" ? "blue" : undefined}
      onClick={(event) => onChoose(accent, event.currentTarget)}
      onPointerEnter={() => onLean(accent)}
      onPointerLeave={() => onLean(null)}
      onFocus={() => onLean(accent)}
      onBlur={() => onLean(null)}
      className="accent-choice flex min-h-[11rem] flex-col items-center justify-between gap-4 rounded-[22px] border border-white/12 bg-white/[0.04] px-3 pt-5 pb-4 text-center min-[380px]:min-h-[13rem] tablet:min-h-[14.5rem]"
    >
      <span
        aria-hidden="true"
        className="accent-orb-float block"
        style={{ "--float-delay": accent === "blue" ? "-2.4s" : "0ms" } as React.CSSProperties}
      >
        <span className="accent-orb block h-16 w-16 min-[380px]:h-[4.75rem] min-[380px]:w-[4.75rem] tablet:h-24 tablet:w-24" />
      </span>

      <span className="flex flex-col items-center gap-1">
        <span className="font-display text-[1.375rem] font-semibold leading-tight text-white">
          {label}
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-pink" aria-hidden="true" />
          {mood}
        </span>
      </span>
    </button>
  );
}
