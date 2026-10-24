"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchUserJourneys } from "@/lib/api/savedJourneys";
import {
  ACHIEVEMENTS_EVENT,
  TIER_LABELS,
  buildContext,
  describe,
  evaluateAchievements,
  medalTier,
  recordProgress,
  type AchievementDef,
} from "@/lib/achievements";
import { JOURNEYS_CHANGED } from "@/lib/journeyEvents";
import { Medal } from "./Medal";

type Toast = { key: string; def: AchievementDef; tier: number };

// "実績解除！" pop-ups. Re-checks achievements on sign-in and whenever the
// journeys change; pages that know more (friend counts…) announce theirs.
export function AchievementToaster() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<Toast[]>([]);

  useEffect(() => {
    const onAnnounce = (event: Event) => {
      const fresh = (event as CustomEvent<{ def: AchievementDef; tier: number }[]>).detail ?? [];
      if (fresh.length) {
        setQueue((current) => [
          ...current,
          ...fresh.map((item) => ({ ...item, key: `${item.def.id}-${item.tier}-${Date.now()}` })),
        ]);
      }
    };
    window.addEventListener(ACHIEVEMENTS_EVENT, onAnnounce);
    return () => window.removeEventListener(ACHIEVEMENTS_EVENT, onAnnounce);
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    let timer: number | undefined;
    const check = async () => {
      try {
        const journeys = await fetchUserJourneys(user.uid);
        if (!active) return;
        const fresh = recordProgress(user.uid, evaluateAchievements(buildContext(journeys)));
        if (fresh.length) window.dispatchEvent(new CustomEvent(ACHIEVEMENTS_EVENT, { detail: fresh }));
      } catch {
        // offline — try on the next change
      }
    };
    const onChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, 700);
    };
    void check();
    window.addEventListener(JOURNEYS_CHANGED, onChange);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener(JOURNEYS_CHANGED, onChange);
    };
  }, [user]);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => setQueue((list) => list.slice(1)), 4600);
    return () => window.clearTimeout(timer);
  }, [current]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[2100] flex justify-center px-4">
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.key}
            initial={{ y: -40, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-[22px] bg-[#1d1a17] text-white shadow-2xl"
          >
            <span aria-hidden className="achievement-shine absolute inset-0" />
            <Link
              href="/achievements"
              onClick={() => setQueue((list) => list.slice(1))}
              className="relative flex items-center gap-3 p-3 pr-4"
            >
              <motion.span
                initial={{ rotate: -30, scale: 0.4 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.1 }}
              >
                <Medal emoji={current.def.emoji} tier={medalTier(current.def, current.tier)} size={52} />
              </motion.span>
              <span className="min-w-0">
                <span className="block text-[10px] font-black tracking-[0.3em] text-[#f3c969]">
                  実績解除！
                </span>
                <span className="block truncate text-base font-bold">
                  {current.def.name}
                  {current.def.tiers.length > 1 && (
                    <span className="ml-1.5 text-xs text-white/70">
                      （{TIER_LABELS[medalTier(current.def, current.tier)]}）
                    </span>
                  )}
                </span>
                <span className="block truncate text-[11px] text-white/70">
                  {describe(current.def, current.def.tiers[current.tier])}
                </span>
              </span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
