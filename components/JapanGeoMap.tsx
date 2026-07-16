"use client";

import { useMemo } from "react";
import { prefectures } from "@/data/prefectures";
import {
  JAPAN_MAP_INNER_TRANSFORM,
  JAPAN_MAP_OUTER_TRANSFORM,
  JAPAN_MAP_VIEWBOX,
  prefectureGeo,
} from "@/components/japanGeoPaths";
import type { PlaceStatus, SavedJourney } from "@/types";
import { statusOf } from "@/lib/utils/travel";

// Score and fill per pipeline status — the further along, the warmer the
// colour and the more points, like a travel-experience ("keikenchi") map.
const tiers: {
  status: PlaceStatus;
  score: number;
  fill: string;
  labelJa: string;
  hintJa: string;
}[] = [
  { status: "done", score: 5, fill: "#f08a68", labelJa: "完了", hintJa: "行ってきた" },
  { status: "exploring", score: 4, fill: "#f2c14e", labelJa: "探索中", hintJa: "いま楽しんでいる" },
  { status: "enroute", score: 3, fill: "#8fd0a8", labelJa: "移動中", hintJa: "向かっている" },
  { status: "going", score: 2, fill: "#85b9e0", labelJa: "行く予定", hintJa: "計画が固まった" },
  { status: "planned", score: 1, fill: "#e9b8ce", labelJa: "計画中", hintJa: "気になっている" },
];

const tierByStatus = new Map(tiers.map((tier) => [tier.status, tier]));
const nameById = new Map(prefectures.map((p) => [p.id, p.nameJa]));

export function JapanGeoMap({
  journeys,
  selectedId = null,
  onSelect,
}: {
  journeys: SavedJourney[];
  selectedId?: string | null;
  onSelect?: (prefectureId: string) => void;
}) {
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

  const totalScore = useMemo(() => {
    let total = 0;
    for (const status of bestByPrefecture.values()) {
      total += tierByStatus.get(status)?.score ?? 0;
    }
    return total;
  }, [bestByPrefecture]);

  return (
    <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5 sm:p-6">
      <div className="text-center">
        <p className="text-xs font-bold tracking-wide text-[color:var(--muted)]">
          NIPPON TRAVEL SCORE
        </p>
        <h2 className="mt-1 text-xl font-black">制覇マップ</h2>
        <span className="mt-3 inline-block rounded-xl bg-sun/30 px-8 py-2.5 text-2xl font-black tabular-nums">
          {totalScore} pts
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Legend */}
        <ul className="flex shrink-0 flex-wrap gap-x-4 gap-y-2 sm:flex-col sm:gap-2.5">
          {tiers.map((tier) => (
            <li key={tier.status} className="flex items-center gap-2">
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-[color:var(--foreground)]/60 text-xs font-black text-[#1f2924]"
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
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-[color:var(--foreground)]/60 bg-[color:var(--surface)] text-xs font-black">
              0
            </span>
            <span className="text-xs font-bold">未踏</span>
            <span className="hidden text-[10px] font-medium text-[color:var(--muted)] sm:inline">
              まだ行っていない
            </span>
          </li>
        </ul>

        {/* The map itself */}
        <svg
          viewBox={JAPAN_MAP_VIEWBOX}
          role="img"
          aria-label={`制覇マップ ${totalScore}ポイント`}
          className="h-auto w-full min-w-0 flex-1"
        >
          <g transform={JAPAN_MAP_OUTER_TRANSFORM}>
            <g transform={JAPAN_MAP_INNER_TRANSFORM}>
              {prefectureGeo.map((geo) => {
                const status = bestByPrefecture.get(geo.id);
                const tier = status ? tierByStatus.get(status) : undefined;
                const selected = selectedId === geo.id;
                return (
                  <g key={geo.id} transform={geo.transform}>
                    <path
                      d={geo.d}
                      fill={tier?.fill ?? "var(--surface)"}
                      stroke="var(--foreground)"
                      strokeOpacity={selected ? 0.95 : 0.5}
                      strokeWidth={selected ? 2.4 : 0.9}
                      strokeLinejoin="round"
                      onClick={onSelect ? () => onSelect(geo.id) : undefined}
                      className={onSelect && tier ? "cursor-pointer" : undefined}
                    >
                      <title>
                        {nameById.get(geo.id) ?? geo.id}
                        {tier ? ` ・ ${tier.labelJa}` : " ・ 未踏"}
                      </title>
                    </path>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
