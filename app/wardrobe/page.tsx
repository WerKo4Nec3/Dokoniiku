"use client";

import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import { useEffect, useMemo } from "react";
import { CabinetHeader } from "@/components/CabinetHeader";
import { TRAVEL_EVENTS } from "@/data/events";
import { TabiSprite } from "@/features/mascot/TabiSprite";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchProfile, saveProfile } from "@/lib/api/profile";
import { completedGoals } from "@/lib/events";
import { useUserJourneys } from "@/lib/hooks/cabinet";
import {
  TABI_SKINS,
  isSkinUnlocked,
  setTabiSkin,
  skinById,
  unlockLabel,
  useTabiSkin,
} from "@/lib/tabiSkin";
import { computeXp, levelForXp } from "@/lib/utils/gamification";

// きせかえ: pick Tabi's look. Colours unlock with level, a few with quests.
export default function WardrobePage() {
  const { user } = useAuth();
  const { journeys } = useUserJourneys();
  const current = useTabiSkin();

  // A skin chosen on another device wins once, on sign-in.
  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchProfile(user.uid)
      .then((profile) => {
        if (active && profile?.tabiSkin && skinById(profile.tabiSkin).id === profile.tabiSkin) {
          setTabiSkin(profile.tabiSkin);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  const progress = useMemo(() => {
    const list = journeys ?? [];
    return {
      level: levelForXp(computeXp(list)).level,
      completedGoals: completedGoals(TRAVEL_EVENTS, list),
    };
  }, [journeys]);

  function choose(id: string) {
    setTabiSkin(id);
    if (user) void saveProfile(user.uid, { tabiSkin: id }).catch(() => {});
  }

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-5xl px-4 pb-20 pt-32 sm:px-6">
      <CabinetHeader
        eyebrow="タビのクローゼット"
        title="きせかえ"
        subtitle="旅を重ねると、新しい色が解放されるよ。クエストのごほうびもあります。"
        accent="vermilion"
      />

      <div className="mt-6 grid items-center gap-6 rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 sm:grid-cols-[auto_1fr] sm:p-8">
        <motion.div
          key={current.id}
          initial={{ scale: 0.85, rotate: -6, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="mx-auto"
        >
          <TabiSprite pose="waving" className="aspect-[538/422] w-56 sm:w-64" />
        </motion.div>
        <div className="text-center sm:text-left">
          <p className="text-[11px] font-black tracking-[0.25em] text-vermilion">いまのタビ</p>
          <h2 className="mt-1 font-display text-3xl font-bold">{current.name}</h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">{current.description}</p>
          <p className="mt-4 text-xs font-bold text-[color:var(--muted)]">
            あなたのレベル：Lv.{progress.level}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TABI_SKINS.map((skin) => {
          const unlocked = isSkinUnlocked(skin, progress);
          const active = skin.id === current.id;
          return (
            <motion.button
              key={skin.id}
              type="button"
              disabled={!unlocked}
              onClick={() => choose(skin.id)}
              whileHover={unlocked ? { y: -4 } : undefined}
              whileTap={unlocked ? { scale: 0.97 } : undefined}
              aria-pressed={active}
              className={`relative flex flex-col items-center gap-2 rounded-[22px] border p-4 text-center transition ${
                active
                  ? "border-vermilion bg-vermilion/5 shadow-float"
                  : "border-[color:var(--line)] bg-[color:var(--surface)]"
              } ${unlocked ? "" : "cursor-not-allowed"}`}
            >
              <span className={`relative block ${unlocked ? "" : "opacity-40 grayscale"}`}>
                <TabiSprite pose="waving" skinId={skin.id} className="aspect-[538/422] w-28" />
              </span>
              <span className="text-sm font-black">{skin.name}</span>
              <span className="text-[11px] font-medium text-[color:var(--muted)]">
                {unlocked ? (active ? "着ています" : "タップで着る") : unlockLabel(skin)}
              </span>
              {active && (
                <span className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-vermilion text-white">
                  <Check size={14} />
                </span>
              )}
              {!unlocked && (
                <span className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-[color:var(--surface-muted)] text-[color:var(--muted)]">
                  <Lock size={12} />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-[color:var(--muted)]">
        浴衣・登山スタイルなどの着せ替え衣装は、近日追加予定。
      </p>
    </section>
  );
}
