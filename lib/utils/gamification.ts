import type { DestinationCategory, PlaceStatus, SavedJourney } from "@/types";
import { statusOf } from "@/lib/utils/travel";

// XP earned for a place at each status (cumulative feel: the further along the
// pipeline, the more it's worth).
const STATUS_XP: Record<PlaceStatus, number> = {
  planned: 5,
  going: 15,
  enroute: 25,
  exploring: 40,
  done: 80,
};

// ---- XP + level ----

export function computeXp(journeys: SavedJourney[]): number {
  let xp = 0;
  const donePrefectures = new Set<string>();
  const doneRegions = new Set<string>();
  for (const journey of journeys) {
    const status = statusOf(journey);
    xp += STATUS_XP[status] ?? 0;
    if (status === "done") {
      donePrefectures.add(journey.prefecture.id);
      if (journey.prefecture.region) doneRegions.add(journey.prefecture.region);
    }
  }
  // Bonus for breadth: each conquered prefecture and region.
  xp += donePrefectures.size * 50;
  xp += doneRegions.size * 100;
  return xp;
}

// Cumulative XP required to reach the start of a level (L1 = 0, L2 = 100,
// L3 = 300, L4 = 600 … each level costs 100 more than the previous).
function xpForLevel(level: number): number {
  return (100 * (level - 1) * level) / 2;
}

export function titleForLevel(level: number): string {
  if (level >= 17) return "伝説の旅人";
  if (level >= 12) return "旅の達人";
  if (level >= 8) return "熟練の旅人";
  if (level >= 5) return "一人前の旅人";
  if (level >= 3) return "駆け出し旅人";
  return "みならい旅人";
}

export type LevelInfo = {
  level: number;
  title: string;
  xp: number;
  intoLevel: number; // xp earned within the current level
  levelSpan: number; // xp needed to clear the current level
  progress: number; // 0..1
};

export function levelForXp(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const levelSpan = next - base;
  const intoLevel = xp - base;
  return {
    level,
    title: titleForLevel(level),
    xp,
    intoLevel,
    levelSpan,
    progress: levelSpan > 0 ? intoLevel / levelSpan : 0,
  };
}

// ---- Stats ----

export type ProfileStats = {
  saved: number;
  done: number;
  prefectures: number;
  regions: number;
  distanceKm: number; // total over done places
  spentYen: number; // total over done places
  categoryCounts: Record<DestinationCategory, number>;
};

export function computeStats(journeys: SavedJourney[]): ProfileStats {
  const prefectures = new Set<string>();
  const regions = new Set<string>();
  const categoryCounts = {} as Record<DestinationCategory, number>;
  let done = 0;
  let distanceKm = 0;
  let spentYen = 0;
  for (const journey of journeys) {
    if (statusOf(journey) !== "done") continue;
    done += 1;
    prefectures.add(journey.prefecture.id);
    if (journey.prefecture.region) regions.add(journey.prefecture.region);
    distanceKm += journey.distanceKm ?? 0;
    spentYen += journey.estimatedBudget?.total ?? 0;
    for (const category of journey.destination.categories) {
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    }
  }
  return {
    saved: journeys.length,
    done,
    prefectures: prefectures.size,
    regions: regions.size,
    distanceKm: Math.round(distanceKm),
    spentYen,
    categoryCounts,
  };
}

// ---- Achievements ----

export type Achievement = {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  earned: boolean;
  current: number;
  target: number;
};

function doneWithCategory(
  journeys: SavedJourney[],
  category: DestinationCategory,
): number {
  return journeys.filter(
    (j) =>
      statusOf(j) === "done" && j.destination.categories.includes(category),
  ).length;
}

export function computeAchievements(journeys: SavedJourney[]): Achievement[] {
  const stats = computeStats(journeys);
  const farthestDone = Math.max(
    0,
    ...journeys
      .filter((j) => statusOf(j) === "done")
      .map((j) => j.distanceKm ?? 0),
  );

  const defs: Omit<Achievement, "earned">[] = [
    {
      id: "first-save",
      name: "はじめの一歩",
      desc: "旅を1つ保存する",
      emoji: "🐣",
      current: Math.min(stats.saved, 1),
      target: 1,
    },
    {
      id: "collector",
      name: "コレクター",
      desc: "旅を10個保存する",
      emoji: "📚",
      current: Math.min(stats.saved, 10),
      target: 10,
    },
    {
      id: "first-done",
      name: "初制覇",
      desc: "1か所を「完了」にする",
      emoji: "🚩",
      current: Math.min(stats.done, 1),
      target: 1,
    },
    {
      id: "pref-5",
      name: "五県制覇",
      desc: "5都道府県を制覇する",
      emoji: "🗾",
      current: Math.min(stats.prefectures, 5),
      target: 5,
    },
    {
      id: "pref-10",
      name: "全国行脚",
      desc: "10都道府県を制覇する",
      emoji: "🎌",
      current: Math.min(stats.prefectures, 10),
      target: 10,
    },
    {
      id: "regions-5",
      name: "地方めぐり",
      desc: "5つの地方を制覇する",
      emoji: "🧭",
      current: Math.min(stats.regions, 5),
      target: 5,
    },
    {
      id: "onsen",
      name: "湯めぐり",
      desc: "温泉を3か所巡る",
      emoji: "♨️",
      current: Math.min(doneWithCategory(journeys, "hot-spring"), 3),
      target: 3,
    },
    {
      id: "history",
      name: "歴史探訪",
      desc: "歴史スポットを3か所巡る",
      emoji: "🏯",
      current: Math.min(doneWithCategory(journeys, "history"), 3),
      target: 3,
    },
    {
      id: "gourmet",
      name: "食い倒れ",
      desc: "グルメを3か所巡る",
      emoji: "🍜",
      current: Math.min(doneWithCategory(journeys, "food"), 3),
      target: 3,
    },
    {
      id: "viewpoint",
      name: "絶景ハンター",
      desc: "絶景を3か所巡る",
      emoji: "⛰️",
      current: Math.min(doneWithCategory(journeys, "viewpoint"), 3),
      target: 3,
    },
    {
      id: "far",
      name: "遠征者",
      desc: "500km以上の旅を完了する",
      emoji: "🛫",
      current: Math.min(farthestDone, 500),
      target: 500,
    },
    {
      id: "distance-1000",
      name: "旅の総距離1000km",
      desc: "完了した旅の合計1000km",
      emoji: "🧳",
      current: Math.min(stats.distanceKm, 1000),
      target: 1000,
    },
  ];

  return defs.map((d) => ({ ...d, earned: d.current >= d.target }));
}
