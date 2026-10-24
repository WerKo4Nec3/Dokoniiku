"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Footprints, Radio, Sparkles, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppIcon, useClock, useToday } from "@/components/tabi-os/AppIcon";
import { TABI_APPS } from "@/components/tabi-os/apps";
import { openAuthDialog } from "@/components/AuthDialog";
import { TRAVEL_EVENTS } from "@/data/events";
import { TabiSprite } from "@/features/mascot/TabiSprite";
import { sessionScene, type Scene } from "@/features/scene/scenes";
import { checkAdmin } from "@/lib/api/admin";
import { eventState } from "@/lib/events";
import { useUserJourneys } from "@/lib/hooks/cabinet";
import { minutesLeft, useLiveShare } from "@/lib/live";
import { useActiveTrip } from "@/lib/trips";
import { computeXp, levelForXp } from "@/lib/utils/gamification";
import { displayPlaceName } from "@/lib/utils/travel";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
};

function greeting(clock: string) {
  const hour = Number(clock.split(":")[0]);
  if (!clock) return "";
  if (hour >= 5 && hour < 11) return "おはよう";
  if (hour >= 11 && hour < 18) return "こんにちは";
  return "こんばんは";
}

function Widget({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={item} className={className}>
      <Link
        href={href}
        className="scene-glass group flex h-full flex-col justify-between gap-3 rounded-[26px] p-4 transition hover:-translate-y-0.5"
      >
        {children}
      </Link>
    </motion.div>
  );
}

// かぜOS home screen: clock, a few live widgets and every app.
export default function TabiHome() {
  const clock = useClock();
  const today = useToday();
  const trip = useActiveTrip();
  const sharing = useLiveShare();
  const { user, journeys } = useUserJourneys();
  const [scene, setScene] = useState<Scene | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setScene(sessionScene());
      setNow(Date.now());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void checkAdmin(user.uid).then((value) => {
      if (active) setIsAdmin(value);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const level = useMemo(() => (journeys ? levelForXp(computeXp(journeys)) : null), [journeys]);
  const quest = useMemo(() => {
    if (now === null) return null;
    const date = new Date(now);
    const states = TRAVEL_EVENTS.map((event) => ({ event, state: eventState(event.window, date) }));
    return (
      states.find((entry) => entry.state.kind === "active") ??
      states.sort((a, b) =>
        a.state.kind === "upcoming" && b.state.kind === "upcoming" ? a.state.daysUntil - b.state.daysUntil : 0,
      )[0]
    );
  }, [now]);
  const apps = TABI_APPS.filter((app) => !app.adminOnly || isAdmin);

  return (
    // z-0 makes this a stacking context, so the wallpaper below paints above
    // the body background but under the home screen.
    <section className="relative z-0 mx-auto min-h-[calc(100vh-4rem)] max-w-5xl px-4 pb-10 pt-32 sm:px-6">
      {/* Wallpaper: today's landing scene, softly veiled. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        {scene && (
          <motion.img
            src={scene.wide.src}
            alt=""
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2 }}
            className="scene-plate h-full w-full object-cover"
            style={{ objectPosition: `${scene.wide.focus[0] * 100}% ${scene.wide.focus[1] * 100}%` }}
          />
        )}
        <div className="absolute inset-0 bg-[color:color-mix(in_srgb,var(--background)_45%,transparent)]" />
      </div>

      <motion.div variants={container} initial="hidden" animate="show">
        <motion.div variants={item} className="scene-copy flex items-end justify-between gap-4">
          <div>
            <p className="font-display text-6xl font-normal tabular-nums tracking-[0.04em] text-[color:var(--foreground)] sm:text-7xl">
              {clock || " "}
            </p>
            <p className="mt-1 text-sm font-bold tracking-[0.15em] text-[color:var(--muted)]">
              {today}
              {greeting(clock) && (
                <span className="block sm:ml-2 sm:inline">{greeting(clock)}、旅人さん</span>
              )}
            </p>
          </div>
          <TabiSprite pose="waving" className="aspect-[538/422] w-28 shrink-0 sm:w-36" />
        </motion.div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Widget href={trip ? "/travel" : "/"} className="col-span-2">
            {trip ? (
              <>
                <span className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-vermilion">
                  <Footprints size={14} />
                  {trip.finishedAt ? "記録しよう" : trip.arrivedAt ? "散策中" : "旅の途中"}
                </span>
                <span className="flex items-center gap-3">
                  {trip.journey.destination.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={trip.journey.destination.imageUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-2xl object-cover"
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-display text-xl font-bold">
                      {displayPlaceName(trip.journey.destination.name)}
                    </span>
                    <span className="block text-xs text-[color:var(--muted)]">
                      {trip.journey.prefecture.nameJa}・タップで旅のページへ
                    </span>
                  </span>
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-vermilion">
                  <Sparkles size={14} /> 次の旅
                </span>
                <span className="flex items-center justify-between gap-3">
                  <span className="font-display text-xl font-bold">次の休日、どこに行く？</span>
                  <ChevronRight className="shrink-0 text-[color:var(--muted)] transition group-hover:translate-x-1" />
                </span>
              </>
            )}
          </Widget>

          {quest && (
            <Widget href="/events">
              <span className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-[0.2em] text-[color:var(--muted)]">クエスト</span>
                <span
                  className="grid h-9 w-9 rotate-[-8deg] place-items-center rounded-md border-2 text-[10px] font-black leading-none"
                  style={{ borderColor: quest.event.color, color: quest.event.color }}
                >
                  {quest.event.seal}
                </span>
              </span>
              <span>
                <span className="block text-sm font-bold leading-snug">{quest.event.title}</span>
                <span className="mt-0.5 block text-[11px] text-[color:var(--muted)]">
                  {quest.state.kind === "active"
                    ? `開催中・あと${quest.state.daysLeft}日`
                    : `あと${quest.state.daysUntil}日で開始`}
                </span>
              </span>
            </Widget>
          )}

          {user ? (
            <Widget href="/profile">
              <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.2em] text-[color:var(--muted)]">
                <Star size={13} className="text-sun" /> タビ手帳
              </span>
              <span>
                <span className="block font-display text-2xl font-bold">Lv.{level?.level ?? "–"}</span>
                <span className="block text-[11px] text-[color:var(--muted)]">{level?.title ?? "読み込み中…"}</span>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
                  <span
                    className="block h-full rounded-full bg-vermilion"
                    style={{ width: `${Math.round((level?.progress ?? 0) * 100)}%` }}
                  />
                </span>
              </span>
            </Widget>
          ) : (
            <motion.div variants={item}>
              <button
                type="button"
                onClick={openAuthDialog}
                className="scene-glass flex h-full w-full flex-col justify-between gap-3 rounded-[26px] p-4 text-left"
              >
                <span className="text-[11px] font-bold tracking-[0.2em] text-[color:var(--muted)]">タビ手帳</span>
                <span className="text-sm font-bold">ログインして、旅の記録を育てよう</span>
              </button>
            </motion.div>
          )}

          <Widget href="/live" className="col-span-2 lg:col-span-4">
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-3">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-2xl ${
                    sharing ? "bg-vermilion text-white" : "bg-[color:var(--surface-muted)] text-[color:var(--muted)]"
                  }`}
                >
                  <Radio size={18} className={sharing ? "animate-pulse" : ""} />
                </span>
                <span>
                  <span className="block text-sm font-bold">
                    {sharing ? "現在地を共有中" : "なかまと現在地をシェア"}
                  </span>
                  <span className="block text-[11px] text-[color:var(--muted)]">
                    {sharing && now !== null
                      ? `あと約${minutesLeft(sharing, now)}分・${sharing.viewers.length}人が見られます`
                      : "待ち合わせや、旅の途中の「いまどこ？」に"}
                  </span>
                </span>
              </span>
              <ChevronRight className="shrink-0 text-[color:var(--muted)] transition group-hover:translate-x-1" />
            </span>
          </Widget>
        </div>

        <div className="mt-8 grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-6">
          {apps.map((app) => (
            <motion.div key={app.id} variants={item}>
              <Link href={app.href} className="group flex flex-col items-center gap-1.5">
                <span className="transition group-hover:-translate-y-1 group-active:scale-95">
                  <AppIcon app={app} />
                </span>
                <span className="rounded-md bg-[color:color-mix(in_srgb,var(--surface)_72%,transparent)] px-1.5 py-0.5 text-center text-[11px] font-bold text-[color:var(--foreground)] backdrop-blur-sm">
                  {app.name}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
