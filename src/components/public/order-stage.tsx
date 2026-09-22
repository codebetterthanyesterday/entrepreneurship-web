import * as React from "react";
import { cn } from "@/lib/utils";
import { summariseStage, type TimelineStageId, type TimelineStep } from "@/lib/order-timeline";
import type { OrderStatus } from "@/types/order";

/**
 * The stage: where an order is, drawn rather than listed.
 *
 * The full timeline still exists further down the page for anyone who wants
 * every step. This is the part a customer glances at between two other things —
 * one picture, one line, one ring that fills as the order moves — so it is the
 * first thing on both the tracker and the confirmation page.
 *
 * No client code in here: the motion is all CSS (`.stage-*` in globals.css), so
 * the confirmation page renders it on the server and the tracker re-renders it
 * as its poll brings news. A new stage remounts the picture through its `key`,
 * which is what plays the pop.
 */

type ArtId = TimelineStageId | "cancelled";

// ---------------------------------------------------------------- the ring

/*
 * A gauge rather than a full circle: 270° open at the bottom, so the first and
 * last stages sit at opposite ends instead of meeting at the top, and the gap
 * leaves room below the picture. Coordinates are for a 200×200 box with the
 * centre at 100,100 and a radius of 86.
 */
const RING_RADIUS = 86;
const RING_START_DEG = 135;
const RING_SWEEP_DEG = 270;

function pointOnRing(fraction: number): { x: number; y: number } {
  const radians = ((RING_START_DEG + RING_SWEEP_DEG * fraction) * Math.PI) / 180;
  return {
    x: 100 + RING_RADIUS * Math.cos(radians),
    y: 100 + RING_RADIUS * Math.sin(radians),
  };
}

const RING_START = pointOnRing(0);
const RING_END = pointOnRing(1);
const RING_PATH = `M${RING_START.x.toFixed(2)} ${RING_START.y.toFixed(2)} A${RING_RADIUS} ${RING_RADIUS} 0 1 1 ${RING_END.x.toFixed(2)} ${RING_END.y.toFixed(2)}`;

export interface StageRingProps {
  status: OrderStatus;
  needsPrep: boolean;
  className?: string;
}

/** The illustration of the current stage, inside a ring showing how far along it is. */
export function StageRing({ status, needsPrep, className }: StageRingProps) {
  const { steps, current, progress } = summariseStage(status, needsPrep);
  const art: ArtId = current?.id ?? "cancelled";
  const cancelled = current === null;

  return (
    <div
      className={cn(
        "relative mx-auto aspect-square w-[13.5rem] tablet:w-[15.5rem]",
        className,
      )}
    >
      <div className="stage-halo absolute inset-[8%] rounded-full" aria-hidden="true" />

      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path
          d={RING_PATH}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className="stroke-white/12"
        />

        {!cancelled && (
          <path
            d={RING_PATH}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100 100"
            strokeDashoffset={100 * (1 - progress)}
            className="stage-ring-progress stroke-pink"
          />
        )}

        {!cancelled &&
          steps.map((step, index) => (
            <RingMark key={step.id} step={step} index={index} count={steps.length} />
          ))}
      </svg>

      {/* The picture. Keyed on the stage so a change remounts it and pops. */}
      <div key={art} className="stage-pop absolute inset-[22%]">
        <StageArt id={art} />
      </div>
    </div>
  );
}

function RingMark({ step, index, count }: { step: TimelineStep; index: number; count: number }) {
  const { x, y } = pointOnRing(count > 1 ? index / (count - 1) : 1);

  if (step.state === "current") {
    return (
      <g>
        <circle cx={x} cy={y} r="7" className="stage-ring-current fill-pink" />
        <circle cx={x} cy={y} r="7" className="fill-pink stroke-ink-deep" strokeWidth="3" />
      </g>
    );
  }

  return (
    <circle
      cx={x}
      cy={y}
      r="4"
      strokeWidth="3"
      className={cn("stroke-ink-deep", step.state === "done" ? "fill-pink" : "fill-white/25")}
    />
  );
}

// ---------------------------------------------------------- the pictures

/** A four-pointed sparkle, its sides curved in toward the centre. */
export function Sparkle({
  x,
  y,
  size,
  delay,
  className = "fill-white",
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
  /** White on the dark band; a light surface passes an accent fill instead. */
  className?: string;
}) {
  const s = size;
  return (
    <path
      d={`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`}
      className={cn("stage-twinkle", className)}
      style={{ "--delay": `${delay}ms` } as React.CSSProperties}
    />
  );
}

/**
 * One picture per stage, drawn on a 120×120 grid in the same chunky, rounded
 * hand: the accent for the object, white for its details.
 */
export function StageArt({ id }: { id: ArtId }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className="stage-art h-full w-full overflow-visible"
      aria-hidden="true"
    >
      {ART[id]}
    </svg>
  );
}

const ART: Record<ArtId, React.ReactNode> = {
  // Pesanan masuk: a fresh ticket.
  masuk: (
    <>
      <g className="stage-float">
        <path
          d="M34 20h52a4 4 0 0 1 4 4v72l-6-5-6 5-6-5-6 5-6-5-6 5-6-5-6 5-6-5-6 5V24a4 4 0 0 1 4-4z"
          className="fill-pink"
        />
        <rect x="42" y="34" width="36" height="6" rx="3" className="fill-white" />
        <rect x="42" y="47" width="22" height="5" rx="2.5" className="fill-white/60" />
        <rect x="42" y="66" width="36" height="3" rx="1.5" className="fill-white/35" />
        <circle cx="74" cy="78" r="4" className="fill-white/80" />
      </g>
      <Sparkle x={98} y={26} size={7} delay={0} />
      <Sparkle x={22} y={48} size={5} delay={700} />
    </>
  ),

  // Udah dikonfirmasi: a seal with a check that draws itself.
  confirmed: (
    <>
      <circle
        cx="60"
        cy="60"
        r="46"
        fill="none"
        strokeWidth="2.5"
        strokeDasharray="3 7"
        strokeLinecap="round"
        className="stage-spin stroke-white/35"
      />
      <circle cx="60" cy="60" r="36" className="fill-pink" />
      <path
        d="M44 61l11 11 22-24"
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stage-draw stroke-white"
      />
      <Sparkle x={100} y={22} size={6} delay={300} />
    </>
  ),

  // Lagi diracik: a cup being made, bubbles rising, straw stirring.
  prep: (
    <>
      <path
        d="M68 34l8-22h9"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stage-stir stroke-white"
      />
      <path d="M36 42h48l-6 56a6 6 0 0 1-6 5.4H48A6 6 0 0 1 42 98z" className="fill-pink" />
      <path d="M40 62h40" strokeWidth="3" strokeLinecap="round" className="stroke-white/30" />
      <rect x="31" y="32" width="58" height="11" rx="5.5" className="fill-white" />
      <circle
        cx="52"
        cy="92"
        r="3"
        className="stage-bubble fill-white"
        style={{ "--delay": "0ms" } as React.CSSProperties}
      />
      <circle
        cx="64"
        cy="94"
        r="2.2"
        className="stage-bubble fill-white"
        style={{ "--delay": "900ms" } as React.CSSProperties}
      />
      <circle
        cx="58"
        cy="90"
        r="2.6"
        className="stage-bubble fill-white"
        style={{ "--delay": "1700ms" } as React.CSSProperties}
      />
      <circle
        cx="70"
        cy="91"
        r="1.8"
        className="stage-bubble fill-white"
        style={{ "--delay": "500ms" } as React.CSSProperties}
      />
    </>
  ),

  // Siap diambil: a packed bag that cannot keep still.
  ready: (
    <>
      <g className="stage-hop">
        <path
          d="M46 46v-8a14 14 0 0 1 28 0v8"
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className="stroke-white"
        />
        <path d="M30 44h60l-4 56a6 6 0 0 1-6 5.5H40A6 6 0 0 1 34 100z" className="fill-pink" />
        <path d="M31 54h58" strokeWidth="3" className="stroke-white/30" />
        <path
          d="M49 76l8 8 15-16"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-white"
        />
      </g>
      <Sparkle x={100} y={34} size={8} delay={0} />
      <Sparkle x={18} y={30} size={6} delay={500} />
      <Sparkle x={104} y={88} size={5} delay={1100} />
    </>
  ),

  // Selesai: a heart, beating.
  done: (
    <>
      <path
        d="M60 98S24 77 24 50a18 18 0 0 1 36-7 18 18 0 0 1 36 7c0 27-36 48-36 48z"
        className="stage-beat fill-pink"
      />
      <path
        d="M40 46a8 8 0 0 1 8-8"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className="stroke-white/60"
      />
      <Sparkle x={100} y={22} size={7} delay={200} />
      <Sparkle x={20} y={26} size={5} delay={900} />
    </>
  ),

  // Dibatalkan: quiet, and deliberately not in the accent.
  cancelled: (
    <>
      <circle cx="60" cy="60" r="34" fill="none" strokeWidth="6" className="stroke-white/30" />
      <path
        d="M47 47l26 26M73 47L47 73"
        strokeWidth="6"
        strokeLinecap="round"
        className="stroke-white/55"
      />
    </>
  ),
};

// ------------------------------------------------------------- the stage

export interface OrderStageProps {
  status: OrderStatus;
  needsPrep: boolean;
  /** The stage's title is the tracker's <h1>; elsewhere it is a lesser heading. */
  titleAs?: "h1" | "h2";
  /** Anything the current stage wants to add under its line, such as the pickup reminder. */
  children?: React.ReactNode;
}

/** The ring, and under it the stage in words: which step, its name, what it means. */
export function OrderStage({
  status,
  needsPrep,
  titleAs: Title = "h2",
  children,
}: OrderStageProps) {
  const { steps, current } = summariseStage(status, needsPrep);
  const position = current ? steps.indexOf(current) + 1 : 0;

  return (
    <div className="text-center">
      <StageRing status={status} needsPrep={needsPrep} />

      <div key={current?.id ?? "cancelled"} className="stage-enter -mt-4 tablet:-mt-6">
        <p className={cn("eyebrow", current ? "text-pink" : "text-white/55")}>
          {current ? `Tahap ${position} dari ${steps.length}` : "Dibatalkan"}
        </p>

        <Title className="display-2 mt-3 text-white">
          {current ? current.title : "Pesanan ini dibatalkan"}
        </Title>

        <p className="lede mx-auto mt-3 text-white/70">
          {current
            ? current.detail
            : "Kalau menurut kamu ini keliru, hubungi kami lewat WhatsApp ya."}
        </p>

        {children}
      </div>
    </div>
  );
}
