import { buildContext, evaluateAchievements } from "@/lib/achievements";
import { computeXp, levelForXp } from "@/lib/utils/gamification";
import { statusOf } from "@/lib/utils/travel";
import type { PublicProfile, SavedJourney } from "@/types";

export type PublicStats = Pick<
  PublicProfile,
  "visitedCount" | "prefectureCount" | "level" | "levelTitle" | "xp" | "medals"
>;

// What other travellers see of your trips on your profile: numbers only.
// Where you've been — places, prefectures, dates — is never published;
// this summary is written to your public profile by your own app.
export function publicStatsFor(journeys: SavedJourney[]): PublicStats {
  const done = journeys.filter((journey) => statusOf(journey) === "done");
  const xp = computeXp(journeys);
  const level = levelForXp(xp);
  const medals = evaluateAchievements(buildContext(journeys)).reduce(
    (sum, achievement) => sum + achievement.tier + 1,
    0,
  );
  return {
    visitedCount: done.length,
    prefectureCount: new Set(done.map((journey) => journey.prefecture.id)).size,
    level: level.level,
    levelTitle: level.title,
    xp,
    medals,
  };
}
