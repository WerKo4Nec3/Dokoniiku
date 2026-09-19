"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useOpenJourney, useUserJourneys } from "@/lib/hooks/cabinet";
import { fetchProfile } from "@/lib/api/profile";
import { ensurePublicProfile } from "@/lib/api/social";
import { statusOf } from "@/lib/utils/travel";
import { computeXp, levelForXp } from "@/lib/utils/gamification";
import { openAuthDialog } from "@/components/AuthDialog";
import { CabinetHeader } from "@/components/CabinetHeader";
import { JapanGeoMap } from "@/components/JapanGeoMap";
import { ProfileCard } from "@/components/ProfileCard";
import { ProfileGameStats } from "@/components/ProfileGameStats";
import type { TabibitoProfile } from "@/types";

export default function ProfilePage() {
  const { linkGoogleAccount } = useAuth();
  const { enabled, loading, user, journeys } = useUserJourneys();
  const openJourney = useOpenJourney();
  const [profile, setProfile] = useState<TabibitoProfile | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchProfile(user.uid)
      .then((data) => {
        if (active && data) setProfile(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  const visitedCount = useMemo(
    () =>
      (journeys ?? []).filter((journey) => statusOf(journey) === "done").length,
    [journeys],
  );
  const level = useMemo(
    () => levelForXp(computeXp(journeys ?? [])),
    [journeys],
  );

  const hasGoogle =
    user?.providerData.some((item) => item.providerId === "google.com") ??
    false;

  // Keep the public profile (friend search) in sync with edits here.
  function handleSaved(next: TabibitoProfile) {
    setProfile(next);
    if (user) {
      ensurePublicProfile(user.uid, { ...next, visitedCount }).catch(() => {});
    }
  }

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-5xl px-4 pb-20 pt-32 sm:px-6">
      <CabinetHeader
        eyebrow="あなたの記録"
        title="プロフィール"
        subtitle="あなたの旅人ステータスと、日本の制覇マップ。"
        mascot="camera"
        accent="forest"
      />

      {!enabled && (
        <p className="mt-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6 text-sm font-medium text-[color:var(--muted)]">
          アカウント機能は現在設定されていません。
        </p>
      )}

      {enabled && !loading && !user && (
        <div className="mt-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-8 text-center">
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
        <div className="mt-8 space-y-6">
          <ProfileCard
            uid={user.uid}
            profile={profile}
            authName={user.displayName}
            photoURL={user.photoURL}
            hasGoogle={hasGoogle}
            level={level.level}
            levelTitle={level.title}
            onSaved={handleSaved}
            onLinkGoogle={linkGoogleAccount}
          />

          <ProfileGameStats journeys={journeys ?? []} />

          <JapanGeoMap journeys={journeys ?? []} onOpenJourney={openJourney} />
        </div>
      )}
    </section>
  );
}
