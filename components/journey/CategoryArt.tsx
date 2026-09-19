import type { ReactNode } from "react";
import type { DestinationCategory } from "@/types";

// Fixed decorative gradients (same convention as placeStatusInfo / difficulty
// in lib/utils/travel.ts). The card chrome stays on tokens, so dark mode +
// palettes keep working; the tiles themselves are self-contained paper-cut art.
export const categoryArtGradient: Record<DestinationCategory, string> = {
  nature: "from-[#63c08a] to-[#2f8f63]",
  history: "from-[#e7a15f] to-[#c05a38]",
  shrine: "from-[#f0836f] to-[#cc3a2c]",
  museum: "from-[#86c1d6] to-[#4886a4]",
  "hot-spring": "from-[#ffcf8b] to-[#ef8a63]",
  food: "from-[#ffc862] to-[#f0913c]",
  viewpoint: "from-[#a3d3ea] to-[#5a84bd]",
};

const W = (a: number) => `rgba(255,255,255,${a})`;
const D = (a: number) => `rgba(20,30,25,${a})`;

const scenes: Record<DestinationCategory, ReactNode> = {
  nature: (
    <>
      <circle cx="97" cy="19" r="11" fill={W(0.75)} />
      <path d="M0 62 Q30 40 60 52 T120 46 V76 H0 Z" fill={W(0.22)} />
      <path d="M0 76 Q40 54 78 64 T120 60 V76 H0 Z" fill={W(0.42)} />
      <rect x="30" y="40" width="4" height="20" rx="2" fill={D(0.18)} />
      <circle cx="32" cy="38" r="12" fill={D(0.16)} />
    </>
  ),
  history: (
    <>
      <rect x="20" y="48" width="80" height="28" fill={W(0.28)} />
      <rect x="42" y="30" width="36" height="24" fill={W(0.45)} />
      <path d="M38 32 L60 20 L82 32 Z" fill={W(0.72)} />
      <path d="M30 50 L60 38 L90 50 Z" fill={W(0.6)} />
      <rect x="55" y="40" width="10" height="12" rx="1" fill={D(0.2)} />
    </>
  ),
  shrine: (
    <>
      <path d="M14 18 Q60 6 106 18 L106 27 Q60 16 14 27 Z" fill={W(0.85)} />
      <rect x="30" y="24" width="9" height="52" fill={W(0.8)} />
      <rect x="81" y="24" width="9" height="52" fill={W(0.8)} />
      <rect x="24" y="34" width="72" height="6" fill={W(0.85)} />
    </>
  ),
  museum: (
    <>
      <path d="M60 16 L104 40 L16 40 Z" fill={W(0.7)} />
      <rect x="20" y="40" width="80" height="6" fill={W(0.55)} />
      <rect x="26" y="46" width="8" height="26" fill={W(0.5)} />
      <rect x="44" y="46" width="8" height="26" fill={W(0.5)} />
      <rect x="62" y="46" width="8" height="26" fill={W(0.5)} />
      <rect x="80" y="46" width="8" height="26" fill={W(0.5)} />
      <rect x="16" y="72" width="88" height="6" fill={W(0.6)} />
    </>
  ),
  "hot-spring": (
    <>
      <path
        d="M28 50 h64 a6 6 0 0 1 6 6 v2 a30 20 0 0 1 -76 0 v-2 a6 6 0 0 1 6 -6 Z"
        fill={W(0.4)}
      />
      <path
        d="M44 42 q-6 -8 0 -16 q6 8 0 16"
        fill="none"
        stroke={W(0.85)}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M60 42 q-6 -8 0 -16 q6 8 0 16"
        fill="none"
        stroke={W(0.85)}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M76 42 q-6 -8 0 -16 q6 8 0 16"
        fill="none"
        stroke={W(0.85)}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </>
  ),
  food: (
    <>
      <path d="M22 44 h76 a38 30 0 0 1 -76 0 Z" fill={W(0.42)} />
      <ellipse cx="60" cy="44" rx="38" ry="7" fill={W(0.7)} />
      <rect
        x="70"
        y="14"
        width="3"
        height="30"
        rx="1.5"
        transform="rotate(14 71 29)"
        fill={D(0.22)}
      />
      <rect
        x="78"
        y="14"
        width="3"
        height="30"
        rx="1.5"
        transform="rotate(20 79 29)"
        fill={D(0.22)}
      />
      <path
        d="M48 30 q-5 -7 0 -13"
        fill="none"
        stroke={W(0.8)}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M60 28 q-5 -7 0 -13"
        fill="none"
        stroke={W(0.8)}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  ),
  viewpoint: (
    <>
      <circle cx="94" cy="22" r="10" fill="rgba(242,193,78,0.92)" />
      <path d="M50 72 L84 30 L120 72 Z" fill={W(0.3)} />
      <path d="M8 72 L46 24 L84 72 Z" fill={W(0.45)} />
      <path
        d="M35 40 L46 24 L57 40 Q52 34 46 38 Q40 42 35 40 Z"
        fill={W(0.92)}
      />
    </>
  ),
};

export function CategoryArt({ category }: { category: DestinationCategory }) {
  return (
    <svg
      viewBox="0 0 120 76"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    >
      {scenes[category]}
    </svg>
  );
}
