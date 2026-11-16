import * as React from "react";
import { cn } from "@/lib/utils";
import { deepen, flavorOf, type FlavorProfile } from "@/lib/flavor";

/**
 * A menu item, drawn from what its name says is in it (`flavorOf`).
 *
 * Most products have no photo, so this is the common case and the thing the
 * menu is made of. Each shape is drawn on a 120×120 grid in the same chunky,
 * rounded hand as the tracker's stage art.
 *
 * `live` turns the small motion on: ice that bobs and bubbles that rise in a
 * drink, steam over something made to order, chocolate that runs. It is for
 * the product's own sheet; the menu's tiles stay still so a page of seven
 * pictures does not fidget. All of it is CSS, so it stops for a reader who asks
 * for less motion (`globals.css`) and the component stays server-safe.
 */
export interface FlavorArtProps {
  product: { name: string; categoryName: string | null };
  /** Made to order: steam rises off food that is. */
  fresh?: boolean;
  live?: boolean;
  className?: string;
}

export function FlavorArt({ product, fresh = false, live = false, className }: FlavorArtProps) {
  const profile = flavorOf(product);
  const id = React.useId().replace(/:/g, "");

  return (
    <svg
      viewBox="0 0 120 120"
      className={cn("flavor-art h-full w-full overflow-visible", live && "is-live", className)}
      aria-hidden="true"
    >
      {/* The shadow it stands on. */}
      <ellipse cx="60" cy="109" rx="34" ry="5" fill="#2e2120" opacity="0.12" />
      <g className="flavor-body">
        {profile.shape === "cup" ? (
          <Cup id={id} profile={profile} />
        ) : (
          <Food id={id} profile={profile} />
        )}
      </g>
      {fresh && profile.shape !== "cup" && <Steam />}
    </svg>
  );
}

// ----------------------------------------------------------------- drinks

/*
 * A tall clear cup. The liquid is one gradient with a soft seam between each
 * layer, clipped to the cup's inside, so three flavours read as poured rather
 * than stacked.
 */
const CUP = "M33 26h54l-6.5 76a6 6 0 0 1-6 5.5H45.5a6 6 0 0 1-6-5.5z";
const LIQUID_TOP = 40;
const LIQUID_BOTTOM = 108;

function Cup({ id, profile }: { id: string; profile: FlavorProfile }) {
  const layers = [...profile.colors].reverse(); // gradient runs top to bottom
  const span = 100 / layers.length;
  const stops = layers.flatMap((color, index) => {
    const start = index * span;
    const end = start + span;
    // A narrow blend at each seam: wide enough to look poured, narrow enough
    // that each layer keeps its own colour.
    return [
      <stop key={`${index}a`} offset={`${index === 0 ? 0 : start + 4}%`} stopColor={color} />,
      <stop key={`${index}b`} offset={`${index === layers.length - 1 ? 100 : end - 4}%`} stopColor={color} />,
    ];
  });

  return (
    <>
      <defs>
        <clipPath id={`${id}-cup`}>
          <path d={CUP} />
        </clipPath>
        <linearGradient
          id={`${id}-liquid`}
          x1="0"
          y1={LIQUID_TOP}
          x2="0"
          y2={LIQUID_BOTTOM}
          gradientUnits="userSpaceOnUse"
        >
          {stops}
        </linearGradient>
      </defs>

      {/* The straw, behind the cup's front wall. */}
      <path
        d="M66 34l9-30h9"
        fill="none"
        stroke="var(--color-pink-deep)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <g clipPath={`url(#${id}-cup)`}>
        <rect x="20" y="20" width="80" height="90" fill="#ffffff" opacity="0.55" />
        <rect x="20" y={LIQUID_TOP} width="80" height="70" fill={`url(#${id}-liquid)`} />
        {/* The surface, catching the light. */}
        <ellipse cx="60" cy={LIQUID_TOP} rx="30" ry="3" fill="#ffffff" opacity="0.35" />

        <g className="flavor-ice">
          <rect x="42" y="37" width="15" height="14" rx="3.5" fill="#ffffff" opacity="0.7" transform="rotate(-12 49 44)" />
          <rect x="59" y="43" width="14" height="13" rx="3.5" fill="#ffffff" opacity="0.55" transform="rotate(14 66 49)" />
        </g>

        <g className="flavor-bubbles" fill="#ffffff" opacity="0.6">
          <circle cx="47" cy="96" r="1.8" />
          <circle cx="58" cy="100" r="1.4" style={{ animationDelay: "-0.9s" }} />
          <circle cx="70" cy="94" r="1.6" style={{ animationDelay: "-1.7s" }} />
        </g>

        {/* The cup's shine, a stripe down the left wall. */}
        <path d="M40 30l4.5 70" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.45" />
      </g>

      {/* Condensation on the outside of an iced drink. */}
      <g fill="#ffffff" opacity="0.8">
        <ellipse cx="76" cy="64" rx="1.6" ry="2.3" />
        <ellipse cx="73" cy="80" rx="1.3" ry="1.9" />
        <ellipse cx="47" cy="88" rx="1.2" ry="1.7" />
      </g>

      <path d={CUP} fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.9" />
      <rect x="29" y="22" width="62" height="8" rx="4" fill="#ffffff" />
    </>
  );
}

// ------------------------------------------------------------------- food

function Food({ id, profile }: { id: string; profile: FlavorProfile }) {
  const [body, extra] = profile.colors as [string, string | undefined];

  switch (profile.shape) {
    case "cookie":
      return <Cookie body={body} chips={extra ?? "#5a3322"} melting={profile.melting} />;
    case "croffle":
      return <Croffle id={id} body={body} sugared={profile.sugared} />;
    case "bar":
      return <Bar body={body} filling={extra} />;
    case "pudding":
      return <Pudding id={id} colors={profile.colors} />;
    case "donut":
      return <Donut body={body} glaze={extra ?? "var(--color-pink)"} sugared={profile.sugared} />;
    case "cake":
      return <Cake body={body} cream={extra ?? "#f3e7d4"} />;
    default:
      return <Bun body={body} sugared={profile.sugared} />;
  }
}

function Cookie({ body, chips, melting }: { body: string; chips: string; melting: boolean }) {
  return (
    <>
      <circle cx="60" cy="66" r="38" fill={deepen(body, 0.18)} />
      <circle cx="60" cy="63" r="37" fill={body} />
      {/* Cracks in a baked top. */}
      <g fill="none" stroke={deepen(body, 0.22)} strokeWidth="2.2" strokeLinecap="round" opacity="0.7">
        <path d="M40 52q6-4 10 1" />
        <path d="M70 80q6 2 9-3" />
        <path d="M64 44q4 3 8 1" />
      </g>
      <g fill={chips}>
        <path d="M46 62l7-3 3 6-6 4z" />
        <path d="M67 54l7 1 0 7-7 1z" />
        <path d="M58 76l6-2 3 5-5 4z" />
        <path d="M78 68l5 1-1 6-5-1z" />
        <path d="M36 72l5 0 1 5-5 1z" />
      </g>
      {melting && (
        // Chocolate pooled on top and running over the edge.
        <g className="flavor-drip">
          <path
            d="M38 50q22-16 44 0q4 4-2 6q-3 1-3 9q0 5-3 5t-3-6q0-5-4-5t-5 4q0 9-4 9t-4-8q0-4-4-4t-4 3q-1 4-4 3t-2-6q1-6-2-10z"
            fill={chips}
          />
          <ellipse cx="54" cy="51" rx="7" ry="2" fill="#ffffff" opacity="0.3" />
        </g>
      )}
    </>
  );
}

function Croffle({ id, body, sugared }: { id: string; body: string; sugared: boolean }) {
  // A croissant's crescent, pressed in a waffle iron.
  const shape =
    "M18 70q4-28 42-34q38 6 42 34q-6 12-16 6q-8-14-26-14t-26 14q-10 6-16-6z";
  return (
    <>
      <defs>
        <clipPath id={`${id}-croffle`}>
          <path d={shape} />
        </clipPath>
      </defs>
      <path d={shape} fill={deepen(body, 0.12)} transform="translate(0 3)" />
      <path d={shape} fill={body} />
      <g clipPath={`url(#${id}-croffle)`} stroke={deepen(body, 0.28)} strokeWidth="3" opacity="0.55">
        {[-30, -15, 0, 15, 30, 45].map((offset) => (
          <path key={`a${offset}`} d={`M${20 + offset} 20l40 70`} />
        ))}
        {[-30, -15, 0, 15, 30, 45].map((offset) => (
          <path key={`b${offset}`} d={`M${100 - offset} 20l-40 70`} />
        ))}
      </g>
      {/* A pat of butter melting on top. */}
      <rect x="52" y="34" width="16" height="11" rx="3" fill="#fbe7a1" transform="rotate(-8 60 40)" />
      {sugared && (
        <g fill="#ffffff">
          {[
            [34, 58],
            [44, 50],
            [58, 52],
            [72, 49],
            [84, 58],
            [50, 62],
            [66, 60],
            [40, 66],
            [80, 66],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.7" />
          ))}
        </g>
      )}
    </>
  );
}

function Bar({ body, filling }: { body: string; filling?: string }) {
  return (
    <g transform="rotate(-10 60 64)">
      <rect x="18" y="40" width="84" height="50" rx="7" fill={deepen(body, 0.25)} transform="translate(0 4)" />
      {/* Gold foil over one end. */}
      <path d="M76 40h19a7 7 0 0 1 7 7v36a7 7 0 0 1-7 7H76z" fill="#d8a93b" />
      <path d="M80 40v50" stroke="#f3d37a" strokeWidth="2" opacity="0.8" />
      <path d="M18 47a7 7 0 0 1 7-7h51v50H25a7 7 0 0 1-7-7z" fill={body} />
      {/* The squares, scored. */}
      <g stroke={deepen(body, 0.35)} strokeWidth="2.5">
        <path d="M45 40v50" />
        <path d="M18 65h58" />
      </g>
      <g fill="#ffffff" opacity="0.12">
        <rect x="22" y="44" width="19" height="17" rx="3" />
        <rect x="49" y="44" width="23" height="17" rx="3" />
      </g>
      {filling && (
        // A bite out of the corner, showing what is inside.
        <>
          <path d="M18 72q8 2 10 9t-3 9H25a7 7 0 0 1-7-7z" fill={filling} />
          <g stroke={deepen(filling, 0.3)} strokeWidth="1.4" strokeLinecap="round">
            <path d="M20 78l5 2" />
            <path d="M21 84l4 1" />
          </g>
          <path d="M18 72q8 2 10 9t-3 9" fill="none" stroke={deepen(body, 0.4)} strokeWidth="2" />
        </>
      )}
    </g>
  );
}

function Pudding({ id, colors }: { id: string; colors: string[] }) {
  const glass = "M30 44h60l-5 52a8 8 0 0 1-8 7H43a8 8 0 0 1-8-7z";
  const layers = colors.slice(0, -1);
  const sauce = colors[colors.length - 1]!;
  const height = 52 / Math.max(1, layers.length);

  return (
    <>
      <defs>
        <clipPath id={`${id}-glass`}>
          <path d={glass} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-glass)`}>
        <rect x="20" y="40" width="80" height="70" fill="#ffffff" opacity="0.6" />
        {layers.map((color, index) => (
          <rect key={color + index} x="20" y={56 + index * height} width="80" height={height + 1} fill={color} />
        ))}
        {/* Caramel on top, settling into the dessert. */}
        <path d="M20 52q10 6 20 1t20 2t20-1t20 1v8H20z" fill={sauce} />
        <path d="M38 48l4 62" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
      </g>
      <path d={glass} fill="none" stroke="#ffffff" strokeWidth="2.5" />
      {/* A spoon resting in it. */}
      <path d="M74 50l14-30" stroke="#c9c2b4" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="89" cy="17" rx="5" ry="7" fill="#d9d3c6" transform="rotate(24 89 17)" />
      <circle cx="52" cy="50" r="3.5" fill="#d8434c" />
    </>
  );
}

function Donut({ body, glaze, sugared }: { body: string; glaze: string; sugared: boolean }) {
  return (
    <>
      <circle cx="60" cy="64" r="38" fill={deepen(body, 0.15)} />
      <circle cx="60" cy="62" r="37" fill={body} />
      <path
        d="M60 29a32 32 0 0 1 32 32c0 6-5 4-8 9s-3 10-9 9-8-6-15-6-10 6-16 5-6-7-9-11-7-3-7-7a32 32 0 0 1 32-31z"
        fill={glaze}
      />
      <circle cx="60" cy="62" r="11" fill="var(--color-cream)" />
      {sugared ? (
        <g fill="#ffffff">
          <circle cx="44" cy="50" r="1.8" />
          <circle cx="74" cy="46" r="1.8" />
          <circle cx="80" cy="62" r="1.8" />
          <circle cx="56" cy="40" r="1.8" />
        </g>
      ) : (
        <g strokeWidth="3.5" strokeLinecap="round">
          <path d="M44 46l4 3" stroke="#ffffff" />
          <path d="M72 40l-3 4" stroke="#f2cf5b" />
          <path d="M82 58l-4 1" stroke="#7fc4ef" />
          <path d="M42 62l4-1" stroke="#ffffff" />
        </g>
      )}
    </>
  );
}

function Cake({ body, cream }: { body: string; cream: string }) {
  return (
    <>
      <path d="M22 54l70-20v54l-70 14z" fill={deepen(body, 0.2)} />
      <path d="M22 54l70-20 8 8-70 20z" fill={cream} />
      <path d="M22 54l8 8v46l-8-6z" fill={deepen(body, 0.35)} />
      <path d="M30 62l70-20v52l-70 14z" fill={body} />
      <path d="M30 80l70-18v6l-70 18z" fill={cream} />
      <circle cx="62" cy="40" r="5" fill="#d8434c" />
    </>
  );
}

function Bun({ body, sugared }: { body: string; sugared: boolean }) {
  return (
    <>
      <path d="M18 78q0-40 42-40t42 40q0 12-12 12H30q-12 0-12-12z" fill={deepen(body, 0.15)} transform="translate(0 3)" />
      <path d="M18 78q0-40 42-40t42 40q0 12-12 12H30q-12 0-12-12z" fill={body} />
      <path d="M34 54q26-12 52 0" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.35" />
      {sugared && (
        <g fill="#ffffff">
          <circle cx="44" cy="58" r="1.8" />
          <circle cx="60" cy="50" r="1.8" />
          <circle cx="76" cy="58" r="1.8" />
        </g>
      )}
    </>
  );
}

/** Three wisps rising off something made to order. */
function Steam() {
  return (
    <g className="flavor-steam" fill="none" stroke="#6a5c56" strokeOpacity="0.35" strokeWidth="3.5" strokeLinecap="round">
      <path d="M44 30q-5-6 0-12t0-12" />
      <path d="M60 26q-5-6 0-12t0-12" style={{ animationDelay: "-0.8s" }} />
      <path d="M76 30q-5-6 0-12t0-12" style={{ animationDelay: "-1.6s" }} />
    </g>
  );
}
