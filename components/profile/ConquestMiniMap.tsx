"use client";

import {
  JAPAN_MAP_INNER_TRANSFORM,
  JAPAN_MAP_OUTER_TRANSFORM,
  JAPAN_MAP_VIEWBOX,
  prefectureGeo,
} from "@/components/japanGeoPaths";

// Japan with the prefectures someone has conquered filled in — the read-only
// map on another traveller's profile (their journeys themselves are private).
export function ConquestMiniMap({
  prefectureIds,
  accent,
}: {
  prefectureIds: string[];
  accent: string;
}) {
  const conquered = new Set(prefectureIds);
  return (
    <svg
      viewBox={JAPAN_MAP_VIEWBOX}
      className="h-full w-full"
      role="img"
      aria-label={`制覇した都道府県 ${conquered.size}/47`}
    >
      <g transform={JAPAN_MAP_OUTER_TRANSFORM}>
        <g transform={JAPAN_MAP_INNER_TRANSFORM}>
          {prefectureGeo.map((geo) => (
            <g key={geo.id} transform={geo.transform}>
              <path
                d={geo.d}
                vectorEffect="non-scaling-stroke"
                strokeWidth={0.8}
                strokeLinejoin="round"
                className={
                  conquered.has(geo.id)
                    ? "stroke-[color:var(--surface)]"
                    : "fill-[color:var(--surface-muted)] stroke-[color:var(--line)]"
                }
                style={conquered.has(geo.id) ? { fill: accent } : undefined}
              />
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}
