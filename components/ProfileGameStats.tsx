"use client";

import { useMemo } from "react";
import { Award, MapPin, Route, Sparkles, Trophy, Wallet } from "lucide-react";
import type { SavedJourney } from "@/types";
import { formatYen } from "@/lib/utils/travel";
import {
  computeAchievements,
  computeStats,
  computeStreak,
  computeWeeklyChallenge,
  computeXp,
  levelForXp,
} from "@/lib/utils/gamification";

export function ProfileGameStats({
  journeys,
}: {
  journeys: SavedJourney[];
}) {
  const { xp, level, stats, achievements, streak, challenge } = useMemo(() => {
    const xp = computeXp(journeys);
    return {
      xp,
      level: levelForXp(xp),
      stats: computeStats(journeys),
      achievements: computeAchievements(journeys),
      streak: computeStreak(journeys, Date.now()),
      challenge: computeWeeklyChallenge(journeys, Date.now()),
    };
  }, [journeys]);

  const earned = achievements.filter((a) => a.earned).length;

  const tiles: { icon: typeof MapPin; value: string; label: string }[] = [
    {
      icon: MapPin,
      value: `${stats.prefectures}/47`,
      label: "制覇した都道府県",
    },
    { icon: Trophy, value: String(stats.done), label: "完了した場所" },
    { icon: Sparkles, value: String(stats.saved), label: "保存した旅" },
    {
      icon: Route,
      value: `${stats.distanceKm.toLocaleString()}km`,
      label: "旅した総距離",
    },
    { icon: Wallet, value: formatYen(stats.spentYen), label: "使った旅費" },
  ];

  return (
    <div className="space-y-6">
      {/* Level + XP */}
      <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-float sm:p-6">
        <div className="flex items-center gap-4">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-vermilion text-white shadow-sm shadow-vermilion/30">
            <span className="text-[10px] font-bold leading-none opacity-80">
              Lv
            </span>
            <span className="text-2xl font-black leading-none">
              {level.level}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-lg font-black">{level.title}</p>
              <p className="shrink-0 text-xs font-bold text-[color:var(--muted)]">
                {xp.toLocaleString()} XP
              </p>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
              <div
                className="h-full rounded-full bg-vermilion transition-all"
                style={{
                  width: `${Math.round(level.progress * 100)}%`,
                }}
              />
            </div>
            <p className="mt-1.5 text-[11px] font-bold text-[color:var(--muted)]">
              次のレベルまで あと{" "}
              {(level.levelSpan - level.intoLevel).toLocaleString()} XP
            </p>
            {streak.best > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-sun/20 px-2.5 py-1 text-[11px] font-black text-[#816106] dark:text-sun">
                  🔥 {streak.current}週連続
                </span>
                <span className="text-[11px] font-bold text-[color:var(--muted)]">
                  最高 {streak.best}週
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weekly mission */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 ${
          challenge.done
            ? "border-forest/40 bg-forest/5"
            : "border-[color:var(--line)] bg-[color:var(--surface)]"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sun/15 text-2xl">
            {challenge.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-[color:var(--muted)]">
              今週のミッション
            </p>
            <p className="text-sm font-black">{challenge.label}</p>
          </div>
          {challenge.done ? (
            <span className="shrink-0 rounded-full bg-forest px-3 py-1 text-xs font-black text-white">
              達成！
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-[color:var(--surface-muted)] px-3 py-1 text-xs font-black text-[color:var(--muted)] tabular-nums">
              {challenge.current}/{challenge.target}
            </span>
          )}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.label}
              className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-4 text-center"
            >
              <Icon
                size={18}
                className="mx-auto text-forest dark:text-forest-ink"
              />
              <p className="mt-2 text-xl font-black tabular-nums">
                {tile.value}
              </p>
              <p className="mt-0.5 text-[11px] font-bold text-[color:var(--muted)]">
                {tile.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Achievements */}
      <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 text-sm font-black">
            <Award size={16} className="text-sun" />
            実績
          </h3>
          <span className="rounded-full bg-vermilion/10 px-2.5 py-1 text-xs font-black text-vermilion tabular-nums">
            {earned}/{achievements.length}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {achievements.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border p-3 text-center transition ${
                a.earned
                  ? "border-vermilion/40 bg-vermilion/5"
                  : "border-[color:var(--line)]"
              }`}
            >
              <span
                className={`mx-auto grid h-12 w-12 place-items-center rounded-full text-2xl ${
                  a.earned
                    ? "bg-sun/20"
                    : "bg-[color:var(--surface-muted)] opacity-40 grayscale"
                }`}
              >
                {a.emoji}
              </span>
              <p className="mt-2 text-xs font-black leading-tight">{a.name}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-[color:var(--muted)]">
                {a.desc}
              </p>
              {a.earned ? (
                <p className="mt-1.5 text-[10px] font-black text-vermilion">
                  達成！
                </p>
              ) : (
                <p className="mt-1.5 text-[10px] font-bold text-[color:var(--muted)] tabular-nums">
                  {a.current.toLocaleString()}/{a.target.toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
