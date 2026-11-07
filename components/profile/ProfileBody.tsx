"use client";

import { useMemo } from "react";
import { statusOf } from "@/lib/utils/travel";
import { FriendLeaderboard } from "@/components/FriendLeaderboard";
import { JapanGeoMap } from "@/components/JapanGeoMap";
import { PassportStamps } from "@/components/PassportStamps";
import { YearRecap } from "@/components/YearRecap";
import { AVATAR_COLORS } from "@/components/profile/ProfileEditor";
import { ProfileHero } from "@/components/profile/ProfileHero";
import {
  LevelCard,
  MedalShelf,
  MissionCard,
  OverviewTiles,
  useProfileGame,
} from "@/components/profile/ProfileOverview";
import type { PublicProfile, SavedJourney, TabibitoProfile } from "@/types";

// The タビ手帳 itself. Phones get one column (hero → 概要 → level → mission →
// medals → …); wide screens a main column plus a side column with the level,
// this week's mission and the friend ranking, like Duolingo on the web.
export function ProfileBody({
  uid,
  displayName,
  profile,
  photoURL,
  joinedLabel,
  friendCode,
  friends,
  journeys,
  now,
  onEdit,
  onOpenJourney,
}: {
  uid: string;
  displayName: string;
  profile: TabibitoProfile | null;
  photoURL?: string | null;
  joinedLabel?: string;
  friendCode?: string;
  friends: PublicProfile[];
  journeys: SavedJourney[];
  now: number | null;
  onEdit: () => void;
  onOpenJourney: (journey: SavedJourney) => void;
}) {
  const game = useProfileGame(journeys, now);
  const visitedCount = useMemo(
    () => journeys.filter((journey) => statusOf(journey) === "done").length,
    [journeys],
  );
  const medals = game.achievements.reduce((sum, a) => sum + a.tier + 1, 0);

  const leaderboard = (
    <FriendLeaderboard
      me={{ uid, name: displayName, visitedCount, avatarEmoji: profile?.avatarEmoji }}
      friends={friends}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
      <div className="min-w-0 space-y-8">
        <ProfileHero
          name={displayName}
          bio={profile?.bio}
          avatarEmoji={profile?.avatarEmoji}
          avatarColor={profile?.avatarColor ?? AVATAR_COLORS[0]}
          photoURL={photoURL}
          levelLabel={`Lv.${game.level.level} ${game.level.title}`}
          friendCode={friendCode}
          joinedLabel={joinedLabel}
          stats={[
            { value: `${game.stats.prefectures}`, label: "都道府県" },
            { value: `${friends.length}`, label: "なかま", href: "/friends" },
            { value: `${medals}`, label: "メダル", href: "/achievements" },
          ]}
          onEdit={onEdit}
        />

        <OverviewTiles game={game} />

        <div className="space-y-4 lg:hidden">
          <LevelCard game={game} />
          <MissionCard game={game} />
        </div>

        <MedalShelf game={game} />

        <YearRecap journeys={journeys} />

        <div className="lg:hidden">{leaderboard}</div>

        <JapanGeoMap journeys={journeys} onOpenJourney={onOpenJourney} />

        <PassportStamps journeys={journeys} />
      </div>

      {/* Sticks below the site header and, inside the tablet frame, its
          status bar (64 + 14 + 12 + 40 px). */}
      <aside className="hidden space-y-4 lg:sticky lg:top-36 lg:block">
        <LevelCard game={game} />
        <MissionCard game={game} />
        {leaderboard}
      </aside>
    </div>
  );
}
