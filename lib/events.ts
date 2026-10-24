import type { EventSpot, QuestGoal, TravelEvent } from "@/data/events";
import { isVerifiedVisit, preciseDistanceKm, statusOf } from "@/lib/utils/travel";
import type { SavedJourney } from "@/types";

const DAY = 86400000;

// "MM-DD" in a given year, at local midnight.
function onDay(year: number, mmdd: string): Date {
  const [m, d] = mmdd.split("-").map(Number);
  return new Date(year, m - 1, d);
}

// The concrete [start, end] of a yearly window that contains or follows
// `now` (windows may wrap past New Year).
export function seasonRange(
  window: readonly [string, string],
  now: Date,
): { start: Date; end: Date } {
  const year = now.getFullYear();
  const wraps = window[0] > window[1];
  for (const startYear of [year - 1, year, year + 1]) {
    const start = onDay(startYear, window[0]);
    const end = onDay(wraps ? startYear + 1 : startYear, window[1]);
    end.setHours(23, 59, 59, 999);
    if (now <= end) return { start, end };
  }
  return { start: onDay(year + 1, window[0]), end: onDay(year + 1, window[1]) };
}

export type EventState =
  | { kind: "active"; daysLeft: number; start: Date; end: Date }
  | { kind: "upcoming"; daysUntil: number; start: Date; end: Date };

export function eventState(window: readonly [string, string], now: Date): EventState {
  const { start, end } = seasonRange(window, now);
  if (now >= start) {
    return { kind: "active", daysLeft: Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY)), start, end };
  }
  return { kind: "upcoming", daysUntil: Math.ceil((start.getTime() - now.getTime()) / DAY), start, end };
}

export type PeakState = "before" | "soon" | "peak" | "after" | "off";

// Where a spot is against its typical peak: two weeks of "colouring",
// the peak itself, then ten days of "falling".
export function peakState(spot: EventSpot, now: Date): PeakState {
  const { start, end } = seasonRange(spot.peak, new Date(now.getTime() - 10 * DAY));
  const t = now.getTime();
  if (t >= start.getTime() && t <= end.getTime()) return "peak";
  if (t < start.getTime()) return start.getTime() - t <= 14 * DAY ? "soon" : "before";
  return t - end.getTime() <= 10 * DAY ? "after" : "off";
}

const PEAK_ORDER: Record<PeakState, number> = { peak: 0, soon: 1, after: 2, before: 3, off: 4 };
export const peakRank = (state: PeakState) => PEAK_ORDER[state];

// "11-15" → "11月中旬"
export function peakLabel(spot: EventSpot): string {
  const part = (mmdd: string) => {
    const [m, d] = mmdd.split("-").map(Number);
    return `${m}月${d <= 10 ? "上旬" : d <= 20 ? "中旬" : "下旬"}`;
  };
  const a = part(spot.peak[0]);
  const b = part(spot.peak[1]);
  return a === b ? a : `${a}〜${b.replace(/^(\d+月)/, (m) => (a.startsWith(m) ? "" : m))}`;
}

// A done journey matches a spot when it was within ~3km of it.
export function matchSpot(event: TravelEvent, journey: SavedJourney): EventSpot | null {
  const d = journey.destination;
  if (!d) return null;
  let best: EventSpot | null = null;
  let bestKm = 3;
  for (const spot of event.spots) {
    const km = preciseDistanceKm(d, spot);
    if (km <= bestKm) {
      best = spot;
      bestKm = km;
    }
  }
  return best;
}

function visitDate(journey: SavedJourney): Date | null {
  const iso = journey.review?.visitedAt ?? journey.checkIns?.[0] ?? journey.createdAt;
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export type QuestProgress = {
  /** Distinct spots visited in the current season. */
  visited: Set<string>;
  verified: Set<string>;
  goals: { goal: QuestGoal; done: number; complete: boolean }[];
};

// Progress for the season that contains (or last contained) `now`.
export function questProgress(
  event: TravelEvent,
  journeys: SavedJourney[],
  now: Date,
): QuestProgress {
  const { start, end } = seasonRange(event.window, now);
  // Before this year's season starts, show nothing (last season is over).
  const visited = new Set<string>();
  const verified = new Set<string>();
  for (const journey of journeys) {
    if (statusOf(journey) !== "done") continue;
    const date = visitDate(journey);
    if (!date || date < start || date > end) continue;
    const spot = matchSpot(event, journey);
    if (!spot) continue;
    visited.add(spot.id);
    if (isVerifiedVisit(journey)) verified.add(spot.id);
  }
  return {
    visited,
    verified,
    goals: event.goals.map((goal) => {
      const done = Math.min(goal.count, (goal.verified ? verified : visited).size);
      return { goal, done, complete: done >= goal.count };
    }),
  };
}

type SeasonTally = { visited: Set<string>; verified: Set<string> };

// Visited spots per event and season year, across all journeys.
function tallySeasons(event: TravelEvent, journeys: SavedJourney[]): SeasonTally[] {
  const seasons = new Map<number, SeasonTally>();
  for (const journey of journeys) {
    if (statusOf(journey) !== "done") continue;
    const date = visitDate(journey);
    if (!date) continue;
    const spot = matchSpot(event, journey);
    if (!spot) continue;
    const { start, end } = seasonRange(event.window, date);
    if (date < start || date > end) continue;
    const key = start.getFullYear();
    const season = seasons.get(key) ?? { visited: new Set(), verified: new Set() };
    season.visited.add(spot.id);
    if (isVerifiedVisit(journey)) season.verified.add(spot.id);
    seasons.set(key, season);
  }
  return [...seasons.values()];
}

const goalMet = (goal: QuestGoal, season: SeasonTally) =>
  (goal.verified ? season.verified : season.visited).size >= goal.count;

// XP earned from quest goals, once per goal per season.
export function eventXp(events: TravelEvent[], journeys: SavedJourney[]): number {
  let xp = 0;
  for (const event of events) {
    for (const season of tallySeasons(event, journeys)) {
      for (const goal of event.goals) if (goalMet(goal, season)) xp += goal.xp;
    }
  }
  return xp;
}

// "eventId:goalId" for every goal ever completed (unlocks rewards).
export function completedGoals(events: TravelEvent[], journeys: SavedJourney[]): Set<string> {
  const done = new Set<string>();
  for (const event of events) {
    for (const season of tallySeasons(event, journeys)) {
      for (const goal of event.goals) if (goalMet(goal, season)) done.add(`${event.id}:${goal.id}`);
    }
  }
  return done;
}
