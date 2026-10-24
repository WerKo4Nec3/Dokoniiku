"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ExternalLink, MapPin, ScrollText, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DEFAULT_START, prefectures } from "@/data/prefectures";
import { EVENT_TEASERS, TRAVEL_EVENTS, type EventSpot, type TravelEvent } from "@/data/events";
import {
  eventState,
  peakLabel,
  peakRank,
  peakState,
  questProgress,
  seasonRange,
  type PeakState,
  type QuestProgress,
} from "@/lib/events";
import { searchCommonsPhotos } from "@/lib/api/wikipedia";
import { normalizePhotoUrl } from "@/lib/photos";
import {
  getStartPointSnapshot,
  parseStartPointSnapshot,
  subscribeStartPoint,
} from "@/lib/storage/startPoint";
import { googleMapsSearchUrl, haversineDistanceKm } from "@/lib/utils/travel";
import type { Destination, SavedJourney } from "@/types";

const ACCEPTED_KEY = "tabi-compass:accepted-quests";
const prefName = new Map(prefectures.map((p) => [p.id, p.nameJa]));
const md = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;

const PEAK_STYLE: Record<PeakState, string> = {
  peak: "bg-vermilion text-white",
  soon: "bg-sun/30 text-[#7a5a05] dark:text-sun",
  after: "bg-[color:var(--surface-muted)] text-[color:var(--muted)]",
  before: "bg-forest/10 text-forest dark:text-forest-ink",
  off: "bg-[color:var(--surface-muted)] text-[color:var(--muted)]",
};

function readAccepted(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ACCEPTED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

// Hand a spot to the journey page, which runs the reveal → result flow.
function planSpot(event: TravelEvent, spot: EventSpot): Destination {
  return {
    id: `quest-${event.id}-${spot.id}`,
    name: spot.name,
    wikiTitle: spot.wiki,
    prefectureId: spot.prefectureId,
    latitude: spot.latitude,
    longitude: spot.longitude,
    categories: event.categories.slice(0, 2),
    description: `${spot.note}。例年の見頃は${peakLabel(spot)}。`,
    imageUrl: spot.image ? normalizePhotoUrl(spot.image) : undefined,
  };
}

// Spots without a stored thumbnail look one up on Commons when shown.
function SpotImage({ spot }: { spot: EventSpot }) {
  const [found, setFound] = useState<string | null>(null);
  useEffect(() => {
    if (spot.image) return;
    let active = true;
    void searchCommonsPhotos(spot.name, 1).then((urls) => {
      if (active && urls[0]) setFound(urls[0]);
    });
    return () => {
      active = false;
    };
  }, [spot]);
  const src = spot.image ? normalizePhotoUrl(spot.image) : found ? normalizePhotoUrl(found) : null;
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />;
}

function rotation(index: number) {
  return [-1.6, 1.2, -0.6, 1.8, -1.2, 0.8][index % 6];
}

export function QuestBoard({ journeys }: { journeys: SavedJourney[] | null }) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);
  const startSnapshot = useSyncExternalStore(subscribeStartPoint, getStartPointSnapshot, () => "");
  const start = parseStartPointSnapshot(startSnapshot) ?? DEFAULT_START;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const date = new Date();
      setNow(date);
      setAccepted(readAccepted());
      // Open the running quest straight away.
      const running = TRAVEL_EVENTS.find((event) => eventState(event.window, date).kind === "active");
      if (running) setOpenId(running.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const progress = useMemo(() => {
    const map = new Map<string, QuestProgress>();
    if (!now) return map;
    for (const event of TRAVEL_EVENTS) map.set(event.id, questProgress(event, journeys ?? [], now));
    return map;
  }, [journeys, now]);

  function toggleAccept(id: string) {
    const next = accepted.includes(id) ? accepted.filter((item) => item !== id) : [...accepted, id];
    setAccepted(next);
    try {
      localStorage.setItem(ACCEPTED_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function go(event: TravelEvent, spot: EventSpot) {
    try {
      sessionStorage.setItem("dokoniiku:plan-destination", JSON.stringify(planSpot(event, spot)));
    } catch {
      return;
    }
    router.push("/");
  }

  if (!now) return <div className="quest-frame mt-6 h-96 animate-pulse" />;
  const open = TRAVEL_EVENTS.find((event) => event.id === openId) ?? null;

  return (
    <div className="mt-6 space-y-6">
      <div className="quest-frame">
        <div className="quest-cork px-4 pb-6 pt-5 sm:px-6">
          <div className="mx-auto mb-6 w-fit rounded-md bg-[#5e3b22] px-5 py-1.5 font-display text-sm font-bold tracking-[0.3em] text-[#f3dfbf] shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_4px_8px_-4px_rgb(0_0_0/0.6)]">
            クエスト掲示板
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {TRAVEL_EVENTS.map((event, index) => {
              const state = eventState(event.window, now);
              const prog = progress.get(event.id);
              const isOpen = openId === event.id;
              const isAccepted = accepted.includes(event.id);
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: -16, rotate: rotation(index) * 2 }}
                  animate={{ opacity: 1, y: 0, rotate: rotation(index) }}
                  whileHover={{ rotate: 0, y: -3 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18, delay: index * 0.08 }}
                  className="quest-note p-5 pt-6"
                  style={{ "--pin": event.color } as React.CSSProperties}
                >
                  <span className="quest-pin" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black tracking-[0.3em] opacity-60">
                        {state.kind === "active" ? "開催中" : "まもなく"}・{md(state.start)}〜{md(state.end)}
                      </p>
                      <h3 className="mt-1 font-display text-xl font-bold">
                        {event.emoji} {event.title}
                      </h3>
                    </div>
                    <span className="quest-seal h-12 w-12 shrink-0 text-sm" style={{ color: event.color }}>
                      {event.seal.slice(0, 1)}
                      <br />
                      {event.seal.slice(1)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 opacity-80">{event.tagline}</p>

                  <ul className="mt-3 space-y-1.5">
                    {prog?.goals.map(({ goal, done, complete }) => (
                      <li key={goal.id} className="flex items-start gap-2 text-xs">
                        <span
                          className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border ${
                            complete ? "border-transparent bg-[#2f6b3a] text-white" : "border-current opacity-50"
                          }`}
                        >
                          {complete && <Check size={11} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block ${complete ? "line-through opacity-60" : ""}`}>
                            {goal.label}
                          </span>
                          <span className="block text-[11px] font-bold opacity-60">
                            {goal.count > 1 && `${done}/${goal.count}・`}+{goal.xp}XP
                            {goal.title && `・称号「${goal.title}」`}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : event.id)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#2b2218] px-4 py-2 text-xs font-bold text-[#fbf3e2]"
                    >
                      <ScrollText size={14} />
                      {isOpen ? "依頼書をとじる" : "依頼書を見る"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAccept(event.id)}
                      className={`rounded-full border px-4 py-2 text-xs font-bold ${
                        isAccepted ? "border-transparent bg-[#c2361f] text-white" : "border-[#2b2218]/30"
                      }`}
                    >
                      {isAccepted ? "受注中" : "受注する"}
                    </button>
                    {state.kind === "active" ? (
                      <span className="ml-auto text-[11px] font-bold opacity-60">のこり{state.daysLeft}日</span>
                    ) : (
                      <span className="ml-auto text-[11px] font-bold opacity-60">あと{state.daysUntil}日</span>
                    )}
                  </div>
                  {isAccepted && (
                    <span className="pointer-events-none absolute -right-2 top-14 rotate-[14deg] rounded border-2 border-[#c2361f] px-2 py-0.5 font-display text-xs font-black text-[#c2361f] opacity-80">
                      受注済
                    </span>
                  )}
                </motion.div>
              );
            })}

            {EVENT_TEASERS.map((teaser, index) => {
              const { start: from, end: to } = seasonRange(teaser.window, now);
              return (
                <div
                  key={teaser.id}
                  className="quest-note quest-note-muted p-4 pt-5"
                  style={{ "--pin": "#8b8172", transform: `rotate(${rotation(index + 2)}deg)` } as React.CSSProperties}
                >
                  <span className="quest-pin" />
                  <p className="text-[10px] font-black tracking-[0.3em] opacity-70">準備中</p>
                  <p className="mt-1 font-display text-base font-bold">
                    {teaser.emoji} {teaser.title}
                  </p>
                  <p className="mt-1 text-[11px] opacity-70">
                    {md(from)}〜{md(to)} ごろ掲示予定
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {open && (
          <QuestDetail
            key={open.id}
            event={open}
            now={now}
            progress={progress.get(open.id) ?? null}
            start={start}
            onClose={() => setOpenId(null)}
            onGo={(spot) => go(open, spot)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function QuestDetail({
  event,
  now,
  progress,
  start,
  onClose,
  onGo,
}: {
  event: TravelEvent;
  now: Date;
  progress: QuestProgress | null;
  start: { latitude: number; longitude: number; name: string };
  onClose: () => void;
  onGo: (spot: EventSpot) => void;
}) {
  const [sort, setSort] = useState<"peak" | "near">("peak");
  const [peakOnly, setPeakOnly] = useState(false);
  const spots = useMemo(() => {
    const rows = event.spots.map((spot) => ({
      spot,
      state: peakState(spot, now),
      km: haversineDistanceKm(start, spot),
    }));
    const filtered = peakOnly ? rows.filter((row) => row.state === "peak" || row.state === "soon") : rows;
    return filtered.sort((a, b) =>
      sort === "near" ? a.km - b.km : peakRank(a.state) - peakRank(b.state) || a.km - b.km,
    );
  }, [event, now, start, sort, peakOnly]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
      className="quest-note rounded-[22px] p-5 sm:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black tracking-[0.3em] opacity-60">依頼書</p>
          <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            {event.emoji} {event.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 opacity-80">{event.description}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="とじる"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#2b2218]/20"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold">
        {(
          [
            ["peak", "見頃順"],
            ["near", `近い順（${start.name}から）`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={sort === id}
            onClick={() => setSort(id)}
            className={`rounded-full px-3.5 py-1.5 ${
              sort === id ? "bg-[#2b2218] text-[#fbf3e2]" : "border border-[#2b2218]/25"
            }`}
          >
            {label}
          </button>
        ))}
        <label className="ml-auto inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={peakOnly}
            onChange={(e) => setPeakOnly(e.target.checked)}
            className="h-4 w-4 accent-[#c2361f]"
          />
          {event.peakLabels.peak}・{event.peakLabels.soon}だけ
        </label>
      </div>
      <p className="mt-2 text-[10px] opacity-60">
        ※ 見頃は例年の目安です。その年の気温で前後するので、お出かけ前に現地の情報を確認してね。
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {spots.map(({ spot, state, km }) => {
          const visited = progress?.visited.has(spot.id);
          return (
            <article
              key={spot.id}
              className="flex flex-col overflow-hidden rounded-2xl bg-white/70 shadow-[0_6px_14px_-10px_rgb(40_20_5/0.6)] dark:bg-white/80"
            >
              <div className="relative h-28 bg-[#e8dcc4]">
                <SpotImage spot={spot} />
                <span className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-black ${PEAK_STYLE[state]}`}>
                  {state === "off" ? "時期外" : event.peakLabels[state]}
                </span>
                {visited && (
                  <span className="quest-seal absolute right-2 top-2 h-10 w-10 bg-white/85 text-[10px] text-[#c2361f]">
                    達成
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-3">
                <h3 className="text-sm font-black">{spot.name}</h3>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] opacity-70">
                  <MapPin size={11} />
                  {prefName.get(spot.prefectureId)}・約{km}km
                </p>
                <p className="mt-1.5 text-xs leading-5 opacity-80">{spot.note}</p>
                <p className="mt-1 text-[11px] font-bold opacity-70">例年の見頃：{peakLabel(spot)}</p>
                <div className="mt-auto flex items-center gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => onGo(spot)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#c2361f] px-3 py-2 text-xs font-bold text-white"
                  >
                    ここへ行く <ArrowRight size={13} />
                  </button>
                  <a
                    href={googleMapsSearchUrl(spot)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Google Mapsで見る"
                    className="grid h-8 w-8 place-items-center rounded-full border border-[#2b2218]/20"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </motion.section>
  );
}
