"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useUserJourneys } from "@/lib/hooks/cabinet";
import { fetchProfile } from "@/lib/api/profile";
import { ensurePublicProfile } from "@/lib/api/social";
import { statusOf } from "@/lib/utils/travel";
import { openAuthDialog } from "@/components/AuthDialog";
import { CabinetNav } from "@/components/CabinetNav";
import { JapanGeoMap } from "@/components/JapanGeoMap";
import { ProfileCard } from "@/components/ProfileCard";
import type { TabibitoProfile } from "@/types";

export default function ProfilePage() {
  const { linkGoogleAccount } = useAuth();
  const { enabled, loading, user, journeys } = useUserJourneys();
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
  const visitedPrefectures = useMemo(
    () =>
      new Set(
        (journeys ?? [])
          .filter((journey) => statusOf(journey) === "done")
          .map((journey) => journey.prefecture.id),
      ).size,
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
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-5xl px-4 pb-20 pt-24 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
      >
        <ArrowLeft size={16} />
        旅にもどる
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mt-4 text-3xl font-black sm:text-4xl">プロフィール</h1>
        <p className="mt-2 text-sm font-medium text-[color:var(--muted)]">
          あなたの旅人ステータスと、日本の制覇マップ。
        </p>
        <CabinetNav />
      </motion.div>

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
            visitedCount={visitedCount}
            onSaved={handleSaved}
            onLinkGoogle={linkGoogleAccount}
          />

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-4">
              <p className="text-2xl font-black tabular-nums">
                {visitedPrefectures}
                <span className="text-sm font-bold text-[color:var(--muted)]">
                  /47
                </span>
              </p>
              <p className="mt-1 text-[11px] font-bold text-[color:var(--muted)]">
                制覇した都道府県
              </p>
            </div>
            <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-4">
              <p className="text-2xl font-black tabular-nums">{visitedCount}</p>
              <p className="mt-1 text-[11px] font-bold text-[color:var(--muted)]">
                完了した場所
              </p>
            </div>
            <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-4">
              <p className="text-2xl font-black tabular-nums">
                {journeys?.length ?? 0}
              </p>
              <p className="mt-1 text-[11px] font-bold text-[color:var(--muted)]">
                保存した旅
              </p>
            </div>
          </div>

          <JapanGeoMap journeys={journeys ?? []} />
        </div>
      )}
    </section>
  );
}
