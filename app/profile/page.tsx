"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useOpenJourney, useUserJourneys } from "@/lib/hooks/cabinet";
import { fetchProfile } from "@/lib/api/profile";
import { ensurePublicProfile, getPublicProfile, listFriendProfiles } from "@/lib/api/social";
import { buildContext, evaluateAchievements } from "@/lib/achievements";
import { statusOf } from "@/lib/utils/travel";
import { computeStats, computeXp, levelForXp } from "@/lib/utils/gamification";
import { openAuthDialog } from "@/components/AuthDialog";
import { CabinetHeader } from "@/components/CabinetHeader";
import { FriendLeaderboard } from "@/components/FriendLeaderboard";
import { PassportStamps } from "@/components/PassportStamps";
import { JapanGeoMap } from "@/components/JapanGeoMap";
import { YearRecap } from "@/components/YearRecap";
import { AVATAR_COLORS, ProfileEditor } from "@/components/profile/ProfileEditor";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileOverview } from "@/components/profile/ProfileOverview";
import type { PublicProfile, TabibitoProfile } from "@/types";

function joinedLabel(creationTime?: string): string | undefined {
  if (!creationTime) return undefined;
  const date = new Date(creationTime);
  if (Number.isNaN(date.getTime())) return undefined;
  return `${date.getFullYear()}年${date.getMonth() + 1}月から旅人`;
}

export default function ProfilePage() {
  const { linkGoogleAccount } = useAuth();
  const { enabled, loading, user, journeys } = useUserJourneys();
  const openJourney = useOpenJourney();
  const [profile, setProfile] = useState<TabibitoProfile | null>(null);
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [friendCode, setFriendCode] = useState<string | undefined>();
  const [editing, setEditing] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchProfile(user.uid)
      .then((data) => {
        if (active && data) setProfile(data);
      })
      .catch(() => {});
    listFriendProfiles(user.uid)
      .then((items) => {
        if (active) setFriends(items);
      })
      .catch(() => {});
    // The friend code lives on the public profile; make one if missing.
    getPublicProfile(user.uid)
      .then((existing) => existing ?? ensurePublicProfile(user.uid, { displayName: user.displayName ?? undefined }))
      .then((publicProfile) => {
        if (active && publicProfile) setFriendCode(publicProfile.friendCode);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  const list = useMemo(() => journeys ?? [], [journeys]);
  const visitedCount = useMemo(() => list.filter((journey) => statusOf(journey) === "done").length, [list]);
  const level = useMemo(() => levelForXp(computeXp(list)), [list]);
  const prefectures = useMemo(() => computeStats(list).prefectures, [list]);
  const medals = useMemo(
    () => evaluateAchievements(buildContext(list)).reduce((sum, a) => sum + a.tier + 1, 0),
    [list],
  );

  const hasGoogle = user?.providerData.some((item) => item.providerId === "google.com") ?? false;
  const displayName = profile?.displayName?.trim() || user?.displayName?.trim() || "旅人";

  // Keep the public profile (friend search) in sync with edits here.
  function handleSaved(next: TabibitoProfile) {
    setProfile(next);
    if (user) {
      ensurePublicProfile(user.uid, { ...next, visitedCount }).catch(() => {});
    }
  }

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-4 pb-20 pt-32 sm:px-6">
      <CabinetHeader title="タビ手帳" subtitle="あなたの旅人ステータスと、日本の制覇マップ。" />

      {!enabled && (
        <p className="mt-6 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6 text-sm font-medium text-[color:var(--muted)]">
          アカウント機能は現在設定されていません。
        </p>
      )}

      {enabled && !loading && !user && (
        <div className="mt-6 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-8 text-center">
          <p className="text-sm font-medium text-[color:var(--muted)]">
            ログインすると、プロフィールと制覇マップが表示されます。
          </p>
          <button
            type="button"
            onClick={() => openAuthDialog()}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            ログイン / 新規登録
          </button>
        </div>
      )}

      {enabled && user && (
        <div className="space-y-8 sm:mt-6">
          <ProfileHero
            name={displayName}
            bio={profile?.bio}
            avatarEmoji={profile?.avatarEmoji}
            avatarColor={profile?.avatarColor ?? AVATAR_COLORS[0]}
            photoURL={user.photoURL}
            levelLabel={`Lv.${level.level} ${level.title}`}
            friendCode={friendCode}
            joinedLabel={joinedLabel(user.metadata.creationTime)}
            stats={[
              { value: `${prefectures}`, label: "都道府県" },
              { value: `${friends.length}`, label: "なかま", href: "/friends" },
              { value: `${medals}`, label: "メダル", href: "/achievements" },
            ]}
            onEdit={() => setEditing(true)}
          />

          <ProfileOverview journeys={list} now={now} />

          <YearRecap journeys={list} />

          <FriendLeaderboard
            me={{
              uid: user.uid,
              name: displayName,
              visitedCount,
              avatarEmoji: profile?.avatarEmoji,
            }}
            friends={friends}
          />

          <JapanGeoMap journeys={list} onOpenJourney={openJourney} />

          <PassportStamps journeys={list} />
        </div>
      )}

      {editing && user && (
        <ProfileEditor
          uid={user.uid}
          profile={profile}
          authName={user.displayName}
          photoURL={user.photoURL}
          hasGoogle={hasGoogle}
          onSaved={handleSaved}
          onClose={() => setEditing(false)}
          onLinkGoogle={linkGoogleAccount}
        />
      )}
    </section>
  );
}
