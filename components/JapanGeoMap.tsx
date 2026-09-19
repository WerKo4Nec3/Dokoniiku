"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { MapPin, RotateCcw } from "lucide-react";
import { prefectures } from "@/data/prefectures";
import {
  JAPAN_MAP_INNER_TRANSFORM,
  JAPAN_MAP_OUTER_TRANSFORM,
  prefectureGeo,
} from "@/components/japanGeoPaths";
import type { PlaceStatus, SavedJourney } from "@/types";
import { placeStatusInfo, statusOf } from "@/lib/utils/travel";

// Colour + score per pipeline status — the further along, the warmer the fill,
// like a travel-experience ("keikenchi") map. `done` tracks the active palette.
const tiers: {
  status: PlaceStatus;
  score: number;
  fill: string;
  labelJa: string;
  hintJa: string;
}[] = [
  { status: "done", score: 5, fill: "rgb(var(--c-vermilion))", labelJa: "完了", hintJa: "行ってきた" },
  { status: "exploring", score: 4, fill: "#f2c14e", labelJa: "探索中", hintJa: "いま楽しんでいる" },
  { status: "enroute", score: 3, fill: "#8fd0a8", labelJa: "移動中", hintJa: "向かっている" },
  { status: "going", score: 2, fill: "#85b9e0", labelJa: "行く予定", hintJa: "計画が固まった" },
  { status: "planned", score: 1, fill: "#e9b8ce", labelJa: "計画中", hintJa: "気になっている" },
];

const tierByStatus = new Map(tiers.map((tier) => [tier.status, tier]));
const nameById = new Map(prefectures.map((p) => [p.id, p.nameJa]));

export function JapanGeoMap({
  journeys,
  onOpenJourney,
}: {
  journeys: SavedJourney[];
  onOpenJourney?: (journey: SavedJourney) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const boxesRef = useRef<
    Record<string, { x: number; y: number; w: number; h: number }>
  >({});
  const viewBoxRef = useRef({ x: 0, y: 0, side: 1000 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; id: string } | null>(
    null,
  );
  const reduce = useReducedMotion();

  const byPrefecture = useMemo(() => {
    const map = new Map<string, SavedJourney[]>();
    for (const journey of journeys) {
      const list = map.get(journey.prefecture.id) ?? [];
      list.push(journey);
      map.set(journey.prefecture.id, list);
    }
    return map;
  }, [journeys]);

  // The best (furthest-along) status per prefecture drives its colour.
  const bestByPrefecture = useMemo(() => {
    const best = new Map<string, PlaceStatus>();
    for (const journey of journeys) {
      const status = statusOf(journey);
      const score = tierByStatus.get(status)?.score ?? 0;
      const current = best.get(journey.prefecture.id);
      const currentScore = current ? (tierByStatus.get(current)?.score ?? 0) : 0;
      if (score > currentScore) best.set(journey.prefecture.id, status);
    }
    return best;
  }, [journeys]);

  // Precompute each prefecture's bounding box in viewBox (0..1000) space, once.
  // getCTM() folds in every ancestor transform, so mapping the bbox corners
  // through it yields the box in canvas units. Geometry never changes.
  useLayoutEffect(() => {
    const next: Record<string, { x: number; y: number; w: number; h: number }> =
      {};
    for (const geo of prefectureGeo) {
      const el = pathRefs.current[geo.id];
      if (!el) continue;
      try {
        const bb = el.getBBox();
        const m = el.getCTM();
        if (!m) continue;
        const px = (x: number, y: number) => ({
          x: m.a * x + m.c * y + m.e,
          y: m.b * x + m.d * y + m.f,
        });
        const c = [
          px(bb.x, bb.y),
          px(bb.x + bb.width, bb.y),
          px(bb.x, bb.y + bb.height),
          px(bb.x + bb.width, bb.y + bb.height),
        ];
        const xs = c.map((p) => p.x);
        const ys = c.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        next[geo.id] = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      } catch {
        // a prefecture that momentarily can't be measured is skipped
      }
    }
    boxesRef.current = next;
    svgRef.current?.setAttribute("viewBox", "0 0 1000 1000");
  }, []);

  function tweenViewBox(to: { x: number; y: number; side: number }) {
    const from = { ...viewBoxRef.current };
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    animate(0, 1, {
      duration: reduce ? 0 : 0.62,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (t) => {
        const x = lerp(from.x, to.x, t);
        const y = lerp(from.y, to.y, t);
        const s = lerp(from.side, to.side, t);
        viewBoxRef.current = { x, y, side: s };
        svgRef.current?.setAttribute("viewBox", `${x} ${y} ${s} ${s}`);
      },
    });
  }

  function focus(id: string) {
    const box = boxesRef.current[id];
    if (!box) return;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const side = Math.min(1000, Math.max(170, Math.max(box.w, box.h) * 1.5));
    const x = Math.max(0, Math.min(cx - side / 2, 1000 - side));
    const y = Math.max(0, Math.min(cy - side / 2, 1000 - side));
    setSelectedId(id);
    setTip(null);
    tweenViewBox({ x, y, side });
  }

  function reset() {
    setSelectedId(null);
    tweenViewBox({ x: 0, y: 0, side: 1000 });
  }

  const hoveredGeo = hoveredId
    ? prefectureGeo.find((g) => g.id === hoveredId)
    : undefined;

  return (
    <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5 sm:p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wide text-[color:var(--muted)]">
            NIPPON TRAVEL MAP
          </p>
          <h2 className="mt-0.5 text-xl font-black">制覇マップ</h2>
        </div>
        <span className="rounded-full bg-vermilion/10 px-3 py-1.5 text-sm font-black text-vermilion tabular-nums">
          {bestByPrefecture.size}
          <span className="text-xs">/47 制覇</span>
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        {/* LEFT: the map */}
        <div className="relative">
          <svg
            ref={svgRef}
            role="img"
            aria-label="日本の制覇マップ"
            className="h-auto w-full min-w-0 select-none"
          >
            <rect
              x="0"
              y="0"
              width="1000"
              height="1000"
              rx="24"
              fill="var(--sky, #75b9c8)"
              opacity={0.06}
            />
            <g transform={JAPAN_MAP_OUTER_TRANSFORM}>
              <g transform={JAPAN_MAP_INNER_TRANSFORM}>
                {prefectureGeo.map((geo) => {
                  const tier = tierByStatus.get(
                    bestByPrefecture.get(geo.id) as PlaceStatus,
                  );
                  const selected = selectedId === geo.id;
                  return (
                    <g key={geo.id} transform={geo.transform}>
                      <path
                        ref={(el) => {
                          pathRefs.current[geo.id] = el;
                        }}
                        d={geo.d}
                        fill={tier?.fill ?? "var(--surface-muted)"}
                        stroke="var(--foreground)"
                        strokeOpacity={selected ? 0.9 : 0.35}
                        strokeWidth={selected ? 2.2 : 0.8}
                        strokeLinejoin="round"
                        tabIndex={0}
                        role="button"
                        aria-label={`${nameById.get(geo.id)} ${
                          tier?.labelJa ?? "未踏"
                        }`}
                        onMouseEnter={() => setHoveredId(geo.id)}
                        onMouseLeave={() => {
                          setHoveredId(null);
                          setTip(null);
                        }}
                        onMouseMove={(e) => {
                          const wrap = svgRef.current?.parentElement;
                          if (!wrap) return;
                          const r = wrap.getBoundingClientRect();
                          setTip({
                            x: e.clientX - r.left,
                            y: e.clientY - r.top,
                            id: geo.id,
                          });
                        }}
                        onFocus={() => setHoveredId(geo.id)}
                        onBlur={() => setHoveredId(null)}
                        onClick={() =>
                          selectedId === geo.id ? reset() : focus(geo.id)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            focus(geo.id);
                          }
                        }}
                        className="cursor-pointer outline-none transition-[stroke-width,stroke-opacity] duration-150"
                      />
                    </g>
                  );
                })}

                {/* highlight clone of the hovered prefecture, drawn last (on top) */}
                {hoveredGeo && !reduce && (
                  <g transform={hoveredGeo.transform} style={{ pointerEvents: "none" }}>
                    <path
                      d={hoveredGeo.d}
                      fill={
                        tierByStatus.get(
                          bestByPrefecture.get(hoveredGeo.id) as PlaceStatus,
                        )?.fill ?? "var(--surface-muted)"
                      }
                      stroke="var(--foreground)"
                      strokeOpacity={0.85}
                      strokeWidth={1.6}
                      strokeLinejoin="round"
                      style={{
                        transformBox: "fill-box",
                        transformOrigin: "center",
                        transform: "scale(1.06)",
                        filter: "drop-shadow(0 4px 6px rgb(31 41 36 / 0.30))",
                        transition: "transform 150ms ease",
                      }}
                    />
                  </g>
                )}
              </g>
            </g>
          </svg>

          {/* tooltip */}
          <AnimatePresence>
            {tip && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                style={{ left: tip.x, top: tip.y }}
                className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-full border border-[color:var(--line)] bg-[color:var(--surface)]/95 px-3 py-1.5 text-xs font-bold shadow-float backdrop-blur"
              >
                {nameById.get(tip.id)}
                <span className="ml-1.5 font-medium text-[color:var(--muted)]">
                  {tierByStatus.get(bestByPrefecture.get(tip.id) as PlaceStatus)
                    ?.labelJa ?? "未踏"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* reset control, only when zoomed */}
          <AnimatePresence>
            {selectedId && (
              <motion.button
                type="button"
                onClick={reset}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)]/95 px-3 py-1.5 text-xs font-bold shadow-float backdrop-blur transition hover:border-vermilion/50"
              >
                <RotateCcw size={13} /> 全体表示
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT: legend when idle, journey panel when a prefecture is selected */}
        <div className="lg:sticky lg:top-32">
          <AnimatePresence mode="wait">
            {selectedId ? (
              <motion.div
                key="panel"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black">
                    {nameById.get(selectedId)}
                  </h3>
                  <span className="text-xs font-bold text-[color:var(--muted)]">
                    {byPrefecture.get(selectedId)?.length ?? 0} 件
                  </span>
                </div>

                {(byPrefecture.get(selectedId)?.length ?? 0) === 0 ? (
                  <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/mascot/map.png"
                      alt=""
                      className="h-16 w-16 opacity-90"
                    />
                    <p className="text-xs font-medium text-[color:var(--muted)]">
                      まだこの県の旅はありません。
                    </p>
                  </div>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {byPrefecture.get(selectedId)!.map((j) => {
                      const info = placeStatusInfo[statusOf(j)];
                      return (
                        <li key={j.id}>
                          <button
                            type="button"
                            onClick={() => onOpenJourney?.(j)}
                            className="group flex w-full items-center gap-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-2 text-left transition hover:border-vermilion/50"
                          >
                            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-forest/10">
                              {j.destination.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={j.destination.imageUrl}
                                  alt=""
                                  loading="lazy"
                                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                />
                              ) : (
                                <span className="grid h-full w-full place-items-center text-forest/50">
                                  <MapPin size={16} />
                                </span>
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-black">
                                {j.destination.name}
                              </span>
                              <span
                                className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${info.className}`}
                              >
                                {info.emoji} {info.labelJa}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </motion.div>
            ) : (
              <motion.ul
                key="legend"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-wrap gap-x-4 gap-y-2 sm:flex-col sm:gap-2.5"
              >
                {tiers.map((tier) => (
                  <li key={tier.status} className="flex items-center gap-2">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-[color:var(--foreground)]/50 text-xs font-black text-[#1f2924]"
                      style={{ backgroundColor: tier.fill }}
                    >
                      {tier.score}
                    </span>
                    <span className="text-xs font-bold">{tier.labelJa}</span>
                    <span className="hidden text-[10px] font-medium text-[color:var(--muted)] sm:inline">
                      {tier.hintJa}
                    </span>
                  </li>
                ))}
                <li className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-[color:var(--foreground)]/50 bg-[color:var(--surface-muted)] text-xs font-black">
                    0
                  </span>
                  <span className="text-xs font-bold">未踏</span>
                  <span className="hidden text-[10px] font-medium text-[color:var(--muted)] sm:inline">
                    タップで拡大
                  </span>
                </li>
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
