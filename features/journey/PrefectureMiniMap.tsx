"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import {
  JAPAN_MAP_INNER_TRANSFORM,
  JAPAN_MAP_OUTER_TRANSFORM,
  JAPAN_MAP_VIEWBOX,
  prefectureGeo,
} from "@/components/japanGeoPaths";

const numbers = (text: string) => (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

const [outerScale, , , , outerX, outerY] = numbers(JAPAN_MAP_OUTER_TRANSFORM);
const [, , , , innerX, innerY] = numbers(JAPAN_MAP_INNER_TRANSFORM);

// Square viewBox around one prefecture (in the map's root coordinates),
// roomy enough to show its neighbours.
function framePrefecture(id: string): string | null {
  const geo = prefectureGeo.find((item) => item.id === id);
  if (!geo) return null;
  const [tx, ty] = numbers(geo.transform);
  const points = numbers(geo.d);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = outerScale * (points[i] + tx + innerX) + outerX;
    const y = outerScale * (points[i + 1] + ty + innerY) + outerY;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const size = Math.max(x1 - x0, y1 - y0, 40) * 2.4;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return [cx - size / 2, cy - size / 2, size, size].map((n) => Math.round(n)).join(" ");
}

// Japan zooms in on the prefecture the compass landed on.
export function PrefectureMiniMap({ id, accent }: { id: string; accent: string }) {
  const reduceMotion = useReducedMotion();
  const frame = useMemo(() => framePrefecture(id), [id]);
  return (
    <motion.svg
      viewBox={JAPAN_MAP_VIEWBOX}
      initial={{ viewBox: JAPAN_MAP_VIEWBOX }}
      animate={{ viewBox: frame ?? JAPAN_MAP_VIEWBOX }}
      transition={{ duration: reduceMotion ? 0 : 1.4, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="h-full w-full"
      role="img"
      aria-label="都道府県の位置"
    >
      <g transform={JAPAN_MAP_OUTER_TRANSFORM}>
        <g transform={JAPAN_MAP_INNER_TRANSFORM}>
          {/* The chosen prefecture is drawn last so its outline sits on top. */}
          {[...prefectureGeo]
            .sort((a, b) => Number(a.id === id) - Number(b.id === id))
            .map((geo) => {
            const active = geo.id === id;
            return (
              <g key={geo.id} transform={geo.transform}>
                <path
                  d={geo.d}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={active ? 1.5 : 0.8}
                  strokeLinejoin="round"
                  className={
                    active
                      ? "stroke-[color:var(--surface)]"
                      : "fill-[color:var(--surface-muted)] stroke-[color:var(--line)]"
                  }
                  style={active ? { fill: accent } : undefined}
                />
              </g>
            );
            })}
        </g>
      </g>
    </motion.svg>
  );
}
