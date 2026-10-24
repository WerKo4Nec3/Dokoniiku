import { TRAVEL_EVENTS } from "@/data/events";
import { completedGoals } from "@/lib/events";
import {
  computeStreak,
  computeXp,
  levelForXp,
} from "@/lib/utils/gamification";
import {
  isVerifiedVisit,
  journeyDifficulty,
  seasonForDate,
  statusOf,
} from "@/lib/utils/travel";
import type { DestinationCategory, SavedJourney } from "@/types";

// 実績: tiered achievements (bronze → platinum), a few secret ones, and an
// achievement score. Everything is derived from the saved journeys (plus
// friend/group counts when the caller has them), so nothing extra is stored
// except which tiers the traveller has already been told about.

export type Tier = 0 | 1 | 2 | 3; // bronze, silver, gold, platinum
export const TIER_LABELS = ["銅", "銀", "金", "白金"] as const;
export const TIER_POINTS = [10, 25, 50, 100] as const;
export const TIER_COLORS = ["#b8733d", "#9aa5b1", "#d9a520", "#7fc6d6"] as const;

export type AchievementCategory = "journey" | "conquest" | "genre" | "onsite" | "record" | "social";

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  journey: "旅立ち",
  conquest: "制覇",
  genre: "ジャンル",
  onsite: "現地",
  record: "記録",
  social: "なかま",
};

export type AchievementContext = {
  done: SavedJourney[];
  saved: number;
  prefectures: number;
  regions: number;
  doneIds: Set<string>;
  totalKm: number;
  farthest: number;
  epic: number;
  genre: Record<DestinationCategory, number>;
  genres: number;
  verified: number;
  checkIns: string[];
  reviews: number;
  photos: number;
  streakBest: number;
  seasons: number;
  questGoals: number;
  level: number;
  friends: number | null;
  groups: number | null;
};

export type AchievementDef = {
  id: string;
  name: string;
  emoji: string;
  category: AchievementCategory;
  /** "{n}" is replaced by the next target. */
  desc: string;
  unit?: string;
  tiers: number[];
  secret?: boolean;
  value: (ctx: AchievementContext) => number | null;
};

const genreDef = (
  id: string,
  category: DestinationCategory,
  name: string,
  emoji: string,
  noun: string,
): AchievementDef => ({
  id,
  name,
  emoji,
  category: "genre",
  desc: `${noun}を{n}か所めぐる`,
  tiers: [1, 3, 10, 25],
  value: (ctx) => ctx.genre[category],
});

const hourOf = (iso: string) => new Date(iso).getHours();

export const ACHIEVEMENTS: AchievementDef[] = [
  // 旅立ち
  { id: "done", name: "旅の足あと", emoji: "🚩", category: "journey", desc: "{n}か所を完了する", tiers: [1, 5, 20, 50], value: (c) => c.done.length },
  { id: "saved", name: "コレクター", emoji: "📚", category: "journey", desc: "旅を{n}個保存する", tiers: [1, 10, 30, 100], value: (c) => c.saved },
  { id: "far", name: "遠征者", emoji: "🛫", category: "journey", desc: "{n}km以上離れた場所を完了する", unit: "km", tiers: [100, 300, 600, 1000], value: (c) => c.farthest },
  { id: "distance", name: "旅の総距離", emoji: "🧳", category: "journey", desc: "完了した旅の合計{n}km", unit: "km", tiers: [500, 2000, 5000, 10000], value: (c) => c.totalKm },
  { id: "epic", name: "伝説の旅路", emoji: "👑", category: "journey", desc: "叙事詩・伝説級の旅を{n}回完了", tiers: [1, 3, 10], value: (c) => c.epic },
  // 制覇
  { id: "prefectures", name: "都道府県制覇", emoji: "🗾", category: "conquest", desc: "{n}都道府県を制覇する", tiers: [5, 15, 30, 47], value: (c) => c.prefectures },
  { id: "regions", name: "地方めぐり", emoji: "🧭", category: "conquest", desc: "{n}地方を制覇する", tiers: [3, 6, 11], value: (c) => c.regions },
  {
    id: "north-south",
    name: "北から南まで",
    emoji: "🌏",
    category: "conquest",
    desc: "北海道と沖縄の両方を制覇する",
    tiers: [1],
    secret: true,
    value: (c) => (c.doneIds.has("hokkaido") && c.doneIds.has("okinawa") ? 1 : 0),
  },
  // ジャンル
  genreDef("nature", "nature", "自然派", "🌲", "自然スポット"),
  genreDef("history", "history", "歴史探訪", "🏯", "歴史スポット"),
  genreDef("shrine", "shrine", "参拝の旅", "⛩️", "神社・寺"),
  genreDef("museum", "museum", "ミュージアム好き", "🖼️", "美術館・博物館"),
  genreDef("onsen", "hot-spring", "湯めぐり", "♨️", "温泉"),
  genreDef("food", "food", "食い倒れ", "🍜", "グルメスポット"),
  genreDef("viewpoint", "viewpoint", "絶景ハンター", "⛰️", "絶景"),
  { id: "all-genres", name: "万能旅人", emoji: "🌈", category: "genre", desc: "{n}ジャンルを制覇する", tiers: [3, 5, 7], value: (c) => c.genres },
  // 現地
  { id: "verified", name: "現地認証", emoji: "📍", category: "onsite", desc: "{n}か所でGPS認証を受ける", tiers: [1, 5, 20, 50], value: (c) => c.verified },
  { id: "checkins", name: "チェックイン魔", emoji: "📮", category: "onsite", desc: "{n}回チェックインする", tiers: [3, 10, 30, 100], value: (c) => c.checkIns.length },
  {
    id: "early-bird",
    name: "早起きは三文の徳",
    emoji: "🌅",
    category: "onsite",
    desc: "朝7時前にチェックインする",
    tiers: [1],
    secret: true,
    value: (c) => (c.checkIns.some((iso) => hourOf(iso) < 7 && hourOf(iso) >= 3) ? 1 : 0),
  },
  {
    id: "night-owl",
    name: "夜の旅人",
    emoji: "🌙",
    category: "onsite",
    desc: "夜9時以降にチェックインする",
    tiers: [1],
    secret: true,
    value: (c) => (c.checkIns.some((iso) => hourOf(iso) >= 21 || hourOf(iso) < 3) ? 1 : 0),
  },
  {
    id: "hopper",
    name: "はしご旅",
    emoji: "🏃",
    category: "onsite",
    desc: "1日に3か所チェックインする",
    tiers: [1],
    secret: true,
    value: (c) => {
      const perDay = new Map<string, number>();
      for (const iso of c.checkIns) {
        const day = new Date(iso).toDateString();
        perDay.set(day, (perDay.get(day) ?? 0) + 1);
      }
      return Math.max(0, ...perDay.values()) >= 3 ? 1 : 0;
    },
  },
  // 記録
  { id: "reviews", name: "旅日記", emoji: "✍️", category: "record", desc: "旅の記録を{n}回書く", tiers: [1, 5, 20], value: (c) => c.reviews },
  { id: "photos", name: "カメラマン", emoji: "📷", category: "record", desc: "旅の写真を{n}枚残す", tiers: [1, 10, 40], value: (c) => c.photos },
  { id: "streak", name: "毎週が旅", emoji: "🔥", category: "record", desc: "{n}週連続で旅をする", unit: "週", tiers: [2, 4, 8, 16], value: (c) => c.streakBest },
  { id: "seasons", name: "四季の旅人", emoji: "🍂", category: "record", desc: "{n}つの季節に旅をする", tiers: [2, 3, 4], value: (c) => c.seasons },
  { id: "quests", name: "クエストハンター", emoji: "📜", category: "record", desc: "クエストの目標を{n}つ達成する", tiers: [1, 3, 6], value: (c) => c.questGoals },
  { id: "level", name: "旅の達人", emoji: "⭐", category: "record", desc: "Lv.{n}に到達する", tiers: [5, 10, 17], value: (c) => c.level },
  // なかま
  { id: "friends", name: "なかまができた", emoji: "🤝", category: "social", desc: "なかまを{n}人つくる", unit: "人", tiers: [1, 5, 15], value: (c) => c.friends },
  { id: "groups", name: "グループの一員", emoji: "👥", category: "social", desc: "{n}つのグループに入る", tiers: [1, 3], value: (c) => c.groups },
];

export function buildContext(
  journeys: SavedJourney[],
  extras: { friends?: number | null; groups?: number | null } = {},
  nowMs: number = Date.now(),
): AchievementContext {
  const done = journeys.filter((journey) => statusOf(journey) === "done");
  const prefectureIds = new Set(done.map((journey) => journey.prefecture.id));
  const regions = new Set(done.map((journey) => journey.prefecture.region).filter(Boolean));
  const genre = {
    nature: 0,
    history: 0,
    shrine: 0,
    museum: 0,
    "hot-spring": 0,
    food: 0,
    viewpoint: 0,
  } as Record<DestinationCategory, number>;
  for (const journey of done) {
    for (const category of new Set(journey.destination.categories)) genre[category] += 1;
  }
  const seasons = new Set(
    done.map((journey) =>
      seasonForDate(new Date(journey.review?.visitedAt ?? journey.checkIns?.[0] ?? journey.createdAt)),
    ),
  );
  return {
    done,
    saved: journeys.length,
    prefectures: prefectureIds.size,
    regions: regions.size,
    doneIds: prefectureIds,
    totalKm: done.reduce((sum, journey) => sum + (journey.distanceKm ?? 0), 0),
    farthest: Math.max(0, ...done.map((journey) => journey.distanceKm ?? 0)),
    epic: done.filter((journey) => {
      const tier = journeyDifficulty(journey.distanceKm, journey.estimatedTravelTime);
      return tier === "epic" || tier === "legendary";
    }).length,
    genre,
    genres: Object.values(genre).filter((count) => count > 0).length,
    verified: done.filter(isVerifiedVisit).length,
    checkIns: journeys.flatMap((journey) => journey.checkIns ?? []),
    reviews: journeys.filter((journey) => journey.review).length,
    photos: journeys.reduce((sum, journey) => sum + (journey.review?.photoIds.length ?? 0), 0),
    streakBest: computeStreak(journeys, nowMs).best,
    seasons: seasons.size,
    questGoals: completedGoals(TRAVEL_EVENTS, journeys).size,
    level: levelForXp(computeXp(journeys)).level,
    friends: extras.friends ?? null,
    groups: extras.groups ?? null,
  };
}

export type AchievementState = {
  def: AchievementDef;
  /** null when the data isn't available (e.g. friends not loaded). */
  value: number | null;
  /** Highest tier reached, or -1. */
  tier: number;
  /** Next target, or null when maxed. */
  next: number | null;
  progress: number;
};

export function evaluateAchievements(ctx: AchievementContext): AchievementState[] {
  return ACHIEVEMENTS.map((def) => {
    const value = def.value(ctx);
    let tier = -1;
    if (value !== null) {
      def.tiers.forEach((target, index) => {
        if (value >= target) tier = index;
      });
    }
    const next = tier + 1 < def.tiers.length ? def.tiers[tier + 1] : null;
    const floor = tier >= 0 ? def.tiers[tier] : 0;
    const progress =
      value === null ? 0 : next === null ? 1 : Math.max(0, Math.min(1, (value - floor) / (next - floor)));
    return { def, value, tier, next, progress };
  });
}

// Medal tier for a tier index; single-step achievements shine gold.
export const medalTier = (def: AchievementDef, tier: number): Tier =>
  (def.tiers.length === 1 ? 2 : Math.min(3, tier)) as Tier;

export function achievementScore(states: AchievementState[]): number {
  let score = 0;
  for (const state of states) {
    for (let t = 0; t <= state.tier; t += 1) score += TIER_POINTS[medalTier(state.def, t)];
  }
  return score;
}

export const describe = (def: AchievementDef, target: number | null) =>
  def.desc.replace("{n}", (target ?? def.tiers[def.tiers.length - 1]).toLocaleString("ja-JP"));

// ---- What the traveller has already been shown (per account, per device) ----

type SeenMap = Record<string, { tier: number; at: string }>;
const seenKey = (uid: string) => `tabi-compass:achievements:${uid}`;

export function readSeen(uid: string): SeenMap | null {
  try {
    const raw = localStorage.getItem(seenKey(uid));
    return raw ? (JSON.parse(raw) as SeenMap) : null;
  } catch {
    return null;
  }
}

// Returns tiers newly reached since last time. The very first evaluation on
// a device records everything silently (no flood of old achievements).
// Achievements whose data is unavailable (value null) are left untouched.
export function recordProgress(
  uid: string,
  states: AchievementState[],
): { def: AchievementDef; tier: number }[] {
  const seen = readSeen(uid);
  const first = seen === null;
  const next: SeenMap = { ...(seen ?? {}) };
  const fresh: { def: AchievementDef; tier: number }[] = [];
  const now = new Date().toISOString();
  for (const state of states) {
    if (state.value === null || state.tier < 0) continue;
    const before = next[state.def.id]?.tier ?? -1;
    if (state.tier > before) {
      next[state.def.id] = { tier: state.tier, at: now };
      if (!first) fresh.push({ def: state.def, tier: state.tier });
    }
  }
  try {
    localStorage.setItem(seenKey(uid), JSON.stringify(next));
  } catch {
    // ignore
  }
  return fresh;
}

// Pop-up channel for <AchievementToaster />.
export const ACHIEVEMENTS_EVENT = "dokoniiku:achievements";

export function announceAchievements(fresh: { def: AchievementDef; tier: number }[]) {
  if (fresh.length && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ACHIEVEMENTS_EVENT, { detail: fresh }));
  }
}
