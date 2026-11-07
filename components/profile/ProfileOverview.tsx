"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { Medal } from "@/components/achievements/Medal";
import { TIER_LABELS, buildContext, evaluateAchievements, medalTier } from "@/lib/achievements";
import {
  computeStats,
  computeStreak,
  computeWeeklyChallenge,
  computeXp,
  levelForXp,
} from "@/lib/utils/gamification";
import { formatYen } from "@/lib/utils/travel";
import type { SavedJourney } from "@/types";

function SectionTitle({ title, href, more }: { title: string; href?: string; more?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-black tracking-[0.18em] text-[color:var(--muted)]">{title}</h3>
      {href && (
        <Link href={href} className="inline-flex items-center gap-0.5 text-xs font-black text-sky">
          {more}
          <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}

// 概要 (overview tiles), the level bar, this week's mission and the medal
// shelf — the game side of the profile.
export function ProfileOverview({ journeys, now }: { journeys: SavedJourney[]; now: number | null }) {
  const data = useMemo(() => {
    const xp = computeXp(journeys);
    const achievements = evaluateAchievements(buildContext(journeys));
    return {
      xp,
      level: levelForXp(xp),
      stats: computeStats(journeys),
      achievements,
      streak: now === null ? { current: 0, best: 0 } : computeStreak(journeys, now),
      challenge: now === null ? null : computeWeeklyChallenge(journeys, now),
    };
  }, [journeys, now]);
  const { xp, level, stats, achievements, streak, challenge } = data;

  const earned = achievements.reduce((sum, a) => sum + a.tier + 1, 0);
  const total = achievements.reduce((sum, a) => sum + a.def.tiers.length, 0);
  // Earned medals first (highest tier), then the closest to unlocking.
  const shelf = achievements
    .filter((a) => !(a.def.secret && a.tier < 0) && a.value !== null)
    .sort((a, b) => b.tier - a.tier || b.progress - a.progress)
    .slice(0, 8);

  const tiles = [
    { emoji: "🔥", value: `${streak.current}週`, label: "連続記録", dim: streak.current === 0 },
    { emoji: "⚡", value: `${xp.toLocaleString("ja-JP")}`, label: "合計XP" },
    { emoji: "📍", value: `${stats.done}`, label: "行った場所" },
    { emoji: "🗾", value: `${stats.prefectures}/47`, label: "都道府県" },
    { emoji: "🛣️", value: `${stats.distanceKm.toLocaleString("ja-JP")}km`, label: "旅した距離" },
    { emoji: "💴", value: formatYen(stats.spentYen), label: "使った旅費" },
  ];

  return (
    <div className="space-y-7">
      <section>
        <SectionTitle title="概要" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="flex items-center gap-3 rounded-2xl border-2 border-[color:var(--line)] px-3.5 py-3"
            >
              <span className={`text-2xl leading-none ${tile.dim ? "opacity-40 grayscale" : ""}`}>{tile.emoji}</span>
              <span className="min-w-0">
                <span className="block truncate text-lg font-black tabular-nums leading-tight">{tile.value}</span>
                <span className="block truncate text-[11px] font-bold text-[color:var(--muted)]">{tile.label}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border-2 border-[color:var(--line)] p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-vermilion text-white">
            <span className="text-center leading-none">
              <span className="block text-[9px] font-bold opacity-80">Lv</span>
              <span className="block text-xl font-black">{level.level}</span>
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-base font-black">{level.title}</p>
              <p className="shrink-0 text-[11px] font-bold text-[color:var(--muted)]">
                あと {(level.levelSpan - level.intoLevel).toLocaleString("ja-JP")} XP
              </p>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
              <div className="h-full rounded-full bg-vermilion" style={{ width: `${Math.round(level.progress * 100)}%` }} />
            </div>
          </div>
        </div>
        {streak.best > 0 && (
          <p className="mt-2 text-right text-[11px] font-bold text-[color:var(--muted)]">最高 {streak.best}週連続</p>
        )}
      </section>

      {challenge && (
        <section
          className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${
            challenge.done ? "border-forest/50 bg-forest/5" : "border-[color:var(--line)]"
          }`}
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sun/15 text-2xl">{challenge.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-[color:var(--muted)]">今週のミッション</p>
            <p className="text-sm font-black">{challenge.label}</p>
          </div>
          {challenge.done ? (
            <span className="shrink-0 rounded-full bg-forest px-3 py-1 text-xs font-black text-white">達成！</span>
          ) : (
            <span className="shrink-0 rounded-full bg-[color:var(--surface-muted)] px-3 py-1 text-xs font-black tabular-nums text-[color:var(--muted)]">
              {challenge.current}/{challenge.target}
            </span>
          )}
        </section>
      )}

      <section>
        <SectionTitle title="実績" href="/achievements" more={`${earned}/${total}`} />
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {shelf.map(({ def, tier, value, next }) => (
            <Link
              key={def.id}
              href="/achievements"
              className="flex w-24 shrink-0 flex-col items-center rounded-2xl border-2 border-[color:var(--line)] px-2 py-3 text-center"
            >
              <Medal emoji={def.emoji} tier={medalTier(def, Math.max(0, tier))} locked={tier < 0} size={52} />
              <span className="mt-2 line-clamp-2 text-[11px] font-black leading-tight">{def.name}</span>
              <span className="mt-0.5 text-[10px] font-bold tabular-nums text-[color:var(--muted)]">
                {tier >= 0 && def.tiers.length > 1 ? `${TIER_LABELS[medalTier(def, tier)]}・` : ""}
                {next === null ? "完" : `${(value ?? 0).toLocaleString("ja-JP")}/${next.toLocaleString("ja-JP")}`}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
