import { buildContext, evaluateAchievements } from "@/lib/achievements";
import { computeXp, levelForXp } from "@/lib/utils/gamification";
import { statusOf } from "@/lib/utils/travel";
import type { PublicPlace, PublicProfile, SavedJourney } from "@/types";

export type PublicStats = Pick<
  PublicProfile,
  "visitedCount" | "prefectureIds" | "level" | "levelTitle" | "xp" | "medals" | "recentPlaces"
>;

const RECENT_PLACES = 6;

// What other travellers see of your trips on your profile: counts, the
// prefectures you've conquered and your last few places. The journeys stay
// private; this summary is written to your public profile by your own app.
export function publicStatsFor(journeys: SavedJourney[]): PublicStats {
  const done = journeys.filter((journey) => statusOf(journey) === "done");
  const xp = computeXp(journeys);
  const level = levelForXp(xp);
  const medals = evaluateAchievements(buildContext(journeys)).reduce(
    (sum, achievement) => sum + achievement.tier + 1,
    0,
  );
  const visitedAt = (journey: SavedJourney) =>
    journey.checkIns?.at(-1) ?? journey.review?.visitedAt ?? journey.createdAt;
  const seen = new Set<string>();
  const recentPlaces: PublicPlace[] = [];
  for (const journey of [...done].sort((a, b) => visitedAt(b).localeCompare(visitedAt(a)))) {
    if (seen.has(journey.destination.id)) continue;
    seen.add(journey.destination.id);
    recentPlaces.push({
      name: journey.destination.name,
      prefectureId: journey.prefecture.id,
      category: journey.destination.categories[0],
      ...(journey.destination.imageUrl ? { imageUrl: journey.destination.imageUrl } : {}),
      at: visitedAt(journey),
    });
    if (recentPlaces.length >= RECENT_PLACES) break;
  }
  return {
    visitedCount: done.length,
    prefectureIds: [...new Set(done.map((journey) => journey.prefecture.id))].sort(),
    level: level.level,
    levelTitle: level.title,
    xp,
    medals,
    recentPlaces,
  };
}
