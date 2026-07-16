"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useOpenJourney, useUserJourneys } from "@/lib/hooks/cabinet";
import { fetchProfile } from "@/lib/api/profile";
import { saveJourneyForUser } from "@/lib/api/savedJourneys";
import { statusOf } from "@/lib/utils/travel";
import { openAuthDialog } from "@/components/AuthDialog";
import { CabinetNav } from "@/components/CabinetNav";
import { FriendsPanel } from "@/components/FriendsPanel";
import type { JourneyResult, TabibitoProfile } from "@/types";

export default function FriendsPage() {
  const { enabled, loading, user, journeys, setJourneys } = useUserJourneys();
  const openJourney = useOpenJourney();
  const [profile, setProfile] = useState<TabibitoProfile | null>(null);
  const [autoAddCode, setAutoAddCode] = useState<string | null>(null);

  // A scanned invite QR opens /friends?add=CODE — pick the code up once.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("add");
    if (code) {
      setAutoAddCode(code.toUpperCase());
      // Clean the URL so a reload doesn't re-send the request.
      window.history.replaceState(null, "", "/friends");
    }
  }, []);

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

  async function saveSharedJourney(journey: JourneyResult) {
    if (!user) return;
    await saveJourneyForUser(user.uid, journey).catch(() => {});
    setJourneys((current) => {
      const base = current ?? [];
      if (base.some((item) => item.id === journey.id)) return current;
      return [journey, ...base];
    });
  }

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-4 pb-20 pt-24 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
      >
        <ArrowLeft size={16} />
        旅にもどる
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mt-4 text-3xl font-black sm:text-4xl">旅の仲間</h1>
        <p className="mt-2 text-sm font-medium text-[color:var(--muted)]">
          QRコードで友達とつながって、旅のカードを共有しよう。
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
            {autoAddCode
              ? "ログインすると、この友達に申請を送れます。"
              : "ログインすると、仲間の機能が使えます。"}
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
        <div className="mt-8">
          <FriendsPanel
            uid={user.uid}
            profile={profile}
            fallbackName={user.displayName ?? user.email ?? "旅人"}
            visitedCount={visitedCount}
            autoAddCode={autoAddCode}
            onOpenJourney={openJourney}
            onSaveShared={saveSharedJourney}
          />
        </div>
      )}
    </section>
  );
}
