"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { CabinetHeader } from "@/components/CabinetHeader";
import { openAuthDialog } from "@/components/AuthDialog";
import { Medal } from "@/components/achievements/Medal";
import { listMyGroups } from "@/lib/api/groups";
import { listFriendProfiles } from "@/lib/api/social";
import {
  CATEGORY_LABELS,
  TIER_COLORS,
  TIER_LABELS,
  achievementScore,
  announceAchievements,
  buildContext,
  describe,
  evaluateAchievements,
  medalTier,
  readSeen,
  recordProgress,
  type AchievementCategory,
} from "@/lib/achievements";
import { useUserJourneys } from "@/lib/hooks/cabinet";

type Filter = AchievementCategory | "all";

export default function AchievementsPage() {
  const { enabled, user, journeys } = useUserJourneys();
  const [extras, setExtras] = useState<{ friends: number | null; groups: number | null }>({
    friends: null,
    groups: null,
  });
  const [extrasLoaded, setExtrasLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [seen, setSeen] = useState<ReturnType<typeof readSeen>>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      listFriendProfiles(user.uid).then((list) => list.length).catch(() => null),
      listMyGroups(user.uid).then((list) => list.length).catch(() => null),
    ]).then(([friends, groups]) => {
      if (!active) return;
      setExtras({ friends, groups });
      setExtrasLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const states = useMemo(
    () => evaluateAchievements(buildContext(journeys ?? [], extras)),
    [journeys, extras],
  );

  // Social achievements are only known here — announce any new tiers.
  useEffect(() => {
    if (!user || journeys === null) return;
    announceAchievements(recordProgress(user.uid, states));
    const timer = window.setTimeout(() => setSeen(readSeen(user.uid)), 0);
    return () => window.clearTimeout(timer);
  }, [user, journeys, states]);

  const score = achievementScore(states);
  const totalTiers = states.reduce((sum, state) => sum + state.def.tiers.length, 0);
  const earnedTiers = states.reduce((sum, state) => sum + state.tier + 1, 0);
  const medals = [0, 0, 0, 0];
  for (const state of states) {
    for (let t = 0; t <= state.tier; t += 1) medals[medalTier(state.def, t)] += 1;
  }
  const shown = states.filter((state) => filter === "all" || state.def.category === filter);

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-5xl px-4 pb-20 pt-32 sm:px-6">
      <CabinetHeader
        eyebrow="トロフィールーム"
        title="実績"
        subtitle="旅を重ねるほど、メダルが銅→銀→金→白金に育つよ。ひみつの実績もあるかも。"
        mascot="camera"
        accent="sun"
      />

      {enabled && !user && (
        <button
          type="button"
          onClick={openAuthDialog}
          className="mt-4 w-full rounded-2xl border border-dashed border-[color:var(--line)] px-4 py-3 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
        >
          ログインすると、実績が記録されます
        </button>
      )}

      <div className="mt-6 grid gap-4 rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-7">
        <div className="text-center sm:pr-6 sm:text-left">
          <p className="text-[11px] font-black tracking-[0.25em] text-[color:var(--muted)]">実績スコア</p>
          <p className="font-display text-5xl font-bold tabular-nums text-[color:var(--foreground)]">
            {score.toLocaleString("ja-JP")}
          </p>
        </div>
        <div>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            {medals.map((count, tier) => (
              <span
                key={tier}
                className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--surface-muted)] px-3 py-1.5 text-xs font-black"
              >
                <span className="h-3 w-3 rounded-full" style={{ background: TIER_COLORS[tier] }} />
                {TIER_LABELS[tier]} {count}
              </span>
            ))}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#b8733d] via-[#d9a520] to-[#7fc6d6]"
              initial={{ width: 0 }}
              animate={{ width: `${(earnedTiers / Math.max(1, totalTiers)) * 100}%` }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </div>
          <p className="mt-1.5 text-center text-[11px] font-bold text-[color:var(--muted)] sm:text-left">
            {earnedTiers}/{totalTiers} メダル
          </p>
        </div>
      </div>

      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
        {(["all", ...Object.keys(CATEGORY_LABELS)] as Filter[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === id
                ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                : "border border-[color:var(--line)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            }`}
          >
            {id === "all" ? "すべて" : CATEGORY_LABELS[id]}
          </button>
        ))}
      </div>

      <motion.div
        key={filter}
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {shown.map((state) => {
          const { def, tier, value, next } = state;
          const hidden = def.secret && tier < 0;
          const earnedAt = seen?.[def.id]?.at;
          return (
            <motion.div
              key={def.id}
              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              className={`flex gap-3 rounded-[22px] border p-4 ${
                tier >= 0
                  ? "border-[color:var(--line)] bg-[color:var(--surface)]"
                  : "border-dashed border-[color:var(--line)] bg-[color:color-mix(in_srgb,var(--surface)_60%,transparent)]"
              }`}
            >
              <Medal
                emoji={def.emoji}
                tier={medalTier(def, Math.max(0, tier))}
                locked={tier < 0}
                secret={hidden}
                size={56}
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-black">
                  <span className="truncate">{hidden ? "？？？" : def.name}</span>
                  {tier >= 0 && def.tiers.length > 1 && (
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-black text-white"
                      style={{ background: TIER_COLORS[medalTier(def, tier)] }}
                    >
                      {TIER_LABELS[medalTier(def, tier)]}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-[color:var(--muted)]">
                  {hidden ? "ひみつの実績。旅のどこかで出会えるかも。" : describe(def, next ?? def.tiers[def.tiers.length - 1])}
                </p>
                {!hidden && (
                  <>
                    <div className="mt-2 flex gap-1">
                      {def.tiers.map((target, index) => (
                        <span
                          key={target}
                          className="h-1.5 flex-1 rounded-full"
                          style={{
                            background: index <= tier ? TIER_COLORS[medalTier(def, index)] : "var(--line)",
                          }}
                        />
                      ))}
                    </div>
                    <p className="mt-1 flex justify-between text-[10px] font-bold text-[color:var(--muted)] tabular-nums">
                      <span>
                        {next === null
                          ? "コンプリート！"
                          : value === null
                            ? extrasLoaded || !user
                              ? "—"
                              : "読み込み中…"
                            : `${value.toLocaleString("ja-JP")} / ${next.toLocaleString("ja-JP")}${def.unit ?? ""}`}
                      </span>
                      {earnedAt && tier >= 0 && (
                        <span>{new Date(earnedAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })} 獲得</span>
                      )}
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
