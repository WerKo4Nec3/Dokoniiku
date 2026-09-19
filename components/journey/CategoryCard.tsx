"use client";

import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";
import type { DestinationCategory } from "@/types";
import { categoryLabels } from "@/lib/utils/travel";

// Bannerlord-style "choose your culture" cards: tall painterly scenes with
// layered silhouettes, an atmospheric sky glow, a lone traveller, and a label
// band. Self-contained inline SVG (no assets), so palettes/dark mode are fine.

export const CATEGORY_ORDER: DestinationCategory[] = [
  "viewpoint",
  "nature",
  "hot-spring",
  "food",
  "shrine",
  "history",
  "museum",
];

type Mood = { skyTop: string; skyBottom: string; glow: string; ink: string };

const MOOD: Record<DestinationCategory, Mood> = {
  viewpoint: { skyTop: "#3a5b8c", skyBottom: "#b9cfe6", glow: "#eef5ff", ink: "#22324c" },
  nature: { skyTop: "#2f6b4a", skyBottom: "#cdeccb", glow: "#f3ffdd", ink: "#1d4230" },
  "hot-spring": { skyTop: "#7a3b2e", skyBottom: "#f3c28c", glow: "#ffe2ba", ink: "#46221b" },
  food: { skyTop: "#3a1c33", skyBottom: "#d1743f", glow: "#ffcf7d", ink: "#2a1220" },
  shrine: { skyTop: "#8c3a2c", skyBottom: "#f0a684", glow: "#ffd9bf", ink: "#4a201a" },
  history: { skyTop: "#3d3350", skyBottom: "#c79ab0", glow: "#ffdccb", ink: "#28223a" },
  museum: { skyTop: "#33586b", skyBottom: "#bfe0ea", glow: "#e9f7ff", ink: "#20404e" },
};

// A lone cloaked traveller, echoing the reference art.
function traveller(cx: number, groundY: number, ink: string) {
  return (
    <g fill={ink}>
      <path d={`M${cx - 9} ${groundY} L${cx} ${groundY - 26} L${cx + 9} ${groundY} Z`} />
      <circle cx={cx} cy={groundY - 30} r="5.2" />
    </g>
  );
}

function scene(category: DestinationCategory, ink: string): ReactNode {
  switch (category) {
    case "viewpoint":
      return (
        <>
          <path d="M0 150 L55 108 L100 150 L150 96 L210 150 L210 280 L0 280 Z" fill={ink} opacity="0.22" />
          <path d="M0 188 L62 128 L112 176 L165 122 L210 168 L210 280 L0 280 Z" fill={ink} opacity="0.46" />
          <path d="M55 130 L62 128 L70 138 Z" fill="#ffffff" opacity="0.9" />
          <path d="M158 126 L165 122 L173 133 Z" fill="#ffffff" opacity="0.9" />
          <path d="M0 226 L72 196 L132 220 L210 200 L210 280 L0 280 Z" fill={ink} opacity="0.82" />
          {traveller(150, 214, ink)}
        </>
      );
    case "nature":
      return (
        <>
          <path d="M0 172 Q105 140 210 172 L210 280 L0 280 Z" fill={ink} opacity="0.24" />
          <path d="M0 208 Q105 176 210 208 L210 280 L0 280 Z" fill={ink} opacity="0.46" />
          <path d="M0 242 Q105 214 210 242 L210 280 L0 280 Z" fill={ink} opacity="0.82" />
          {[40, 58, 150, 168].map((x, i) => (
            <path key={i} d={`M${x} 236 L${x + 9} 214 L${x + 18} 236 Z`} fill={ink} opacity="0.82" />
          ))}
          {traveller(105, 250, ink)}
        </>
      );
    case "hot-spring":
      return (
        <>
          <path d="M0 152 L70 96 L140 150 L210 108 L210 280 L0 280 Z" fill={ink} opacity="0.28" />
          {[70, 105, 140].map((x, i) => (
            <path
              key={i}
              d={`M${x} 214 q-7 -12 0 -22 q7 12 0 22`}
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.7"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          ))}
          <path d="M32 250 L44 224 Q105 200 166 224 L178 250 Z" fill={ink} opacity="0.85" />
          <rect x="40" y="248" width="130" height="32" fill={ink} opacity="0.85" />
          {traveller(150, 252, ink)}
        </>
      );
    case "food":
      return (
        <>
          <rect x="8" y="150" width="60" height="130" fill={ink} opacity="0.8" />
          <rect x="78" y="128" width="58" height="152" fill={ink} opacity="0.86" />
          <rect x="146" y="160" width="56" height="120" fill={ink} opacity="0.8" />
          {[[20, 170], [40, 190], [92, 150], [112, 176], [158, 182]].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="9" height="11" fill="#ffd27a" opacity="0.92" />
          ))}
          {[60, 96, 132].map((x, i) => (
            <g key={i}>
              <rect x={x - 0.5} y="70" width="1.5" height="18" fill={ink} opacity="0.7" />
              <ellipse cx={x} cy="96" rx="7" ry="9" fill="#e8583e" />
              <ellipse cx={x} cy="93" rx="3" ry="3.5" fill="#ffd27a" opacity="0.8" />
            </g>
          ))}
          {traveller(105, 262, ink)}
        </>
      );
    case "shrine":
      return (
        <>
          <path d="M0 176 Q60 150 105 172 Q150 150 210 176 L210 280 L0 280 Z" fill={ink} opacity="0.32" />
          {/* torii */}
          <path d="M40 118 Q105 104 170 118 L170 130 Q105 116 40 130 Z" fill={ink} opacity="0.85" />
          <rect x="48" y="126" width="12" height="120" fill={ink} opacity="0.85" />
          <rect x="150" y="126" width="12" height="120" fill={ink} opacity="0.85" />
          <rect x="36" y="140" width="138" height="9" fill={ink} opacity="0.85" />
          {[248, 260, 272].map((y, i) => (
            <rect key={i} x={70 - i * 8} y={y} width={68 + i * 16} height="7" fill={ink} opacity="0.7" />
          ))}
          {traveller(105, 250, ink)}
        </>
      );
    case "history":
      return (
        <>
          <path d="M0 196 Q105 156 210 196 L210 280 L0 280 Z" fill={ink} opacity="0.3" />
          {/* tiered keep */}
          <rect x="80" y="150" width="50" height="34" fill={ink} opacity="0.85" />
          <path d="M74 150 L105 132 L136 150 Z" fill={ink} opacity="0.85" />
          <rect x="72" y="184" width="66" height="30" fill={ink} opacity="0.85" />
          <path d="M64 184 L105 166 L146 184 Z" fill={ink} opacity="0.85" />
          <rect x="60" y="214" width="90" height="30" fill={ink} opacity="0.85" />
          <path d="M50 214 L105 194 L160 214 Z" fill={ink} opacity="0.85" />
          {traveller(150, 258, ink)}
        </>
      );
    case "museum":
      return (
        <>
          <path d="M0 210 Q105 188 210 210 L210 280 L0 280 Z" fill={ink} opacity="0.28" />
          <path d="M52 150 L105 120 L158 150 Z" fill={ink} opacity="0.85" />
          <rect x="52" y="150" width="106" height="8" fill={ink} opacity="0.85" />
          {[62, 84, 106, 128, 150].map((x, i) => (
            <rect key={i} x={x - 4} y="158" width="8" height="60" fill={ink} opacity="0.8" />
          ))}
          <rect x="44" y="218" width="122" height="10" fill={ink} opacity="0.85" />
          <rect x="36" y="228" width="138" height="10" fill={ink} opacity="0.7" />
          {traveller(150, 250, ink)}
        </>
      );
    default:
      return null;
  }
}

export function CategoryCard({
  category,
  selected,
  onClick,
  dimmed = false,
}: {
  category: DestinationCategory;
  selected: boolean;
  onClick: () => void;
  // When another card is selected in a single-select context, fade the rest.
  dimmed?: boolean;
}) {
  const uid = useId();
  const skyId = `sky-${uid}`;
  const glowId = `glow-${uid}`;
  const mood = MOOD[category];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative aspect-[3/4] w-full overflow-hidden rounded-2xl border-2 text-left shadow-sm transition duration-200 ${
        selected
          ? "border-vermilion shadow-float"
          : "border-transparent hover:-translate-y-0.5 hover:shadow-float"
      } ${dimmed && !selected ? "opacity-60 saturate-[0.8]" : ""}`}
    >
      <svg
        viewBox="0 0 210 280"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mood.skyTop} />
            <stop offset="1" stopColor={mood.skyBottom} />
          </linearGradient>
          <radialGradient id={glowId} cx="0.7" cy="0.28" r="0.6">
            <stop offset="0" stopColor={mood.glow} stopOpacity="0.9" />
            <stop offset="1" stopColor={mood.glow} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="210" height="280" fill={`url(#${skyId})`} />
        <rect x="0" y="0" width="210" height="280" fill={`url(#${glowId})`} />
        {scene(category, mood.ink)}
      </svg>

      {/* label scrim + label */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 px-2 pb-3 text-center font-display text-sm font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] sm:text-base">
        {categoryLabels[category]}
      </span>

      {/* selected check */}
      <span
        className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full transition ${
          selected
            ? "scale-100 bg-vermilion text-white opacity-100"
            : "scale-75 bg-white/80 text-transparent opacity-0"
        }`}
      >
        <Check size={16} strokeWidth={3} />
      </span>
    </button>
  );
}
