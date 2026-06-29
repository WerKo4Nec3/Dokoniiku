"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, MapPin, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { deleteUserJourney, fetchUserJourneys } from "@/lib/api/savedJourneys";
import {
  categoryLabels,
  formatMinutes,
  formatYen,
  googleMapsSearchUrl,
  transportLabel,
} from "@/lib/utils/travel";
import type { JourneyResult } from "@/types";

export default function SavedPage() {
  const { enabled, loading, user, signInWithGoogle } = useAuth();
  // null = not loaded yet (shows the loading state).
  const [journeys, setJourneys] = useState<JourneyResult[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchUserJourneys(user.uid)
      .then((items) => {
        if (active) setJourneys(items);
      })
      .catch(() => {
        if (active) setJourneys([]);
      });
    return () => {
      active = false;
    };
  }, [user]);

  async function handleDelete(id: string) {
    if (!user) return;
    setJourneys((current) =>
      current ? current.filter((item) => item.id !== id) : current,
    );
    await deleteUserJourney(user.uid, id).catch(() => {});
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

      <h1 className="mt-4 text-3xl font-black sm:text-4xl">保存した旅</h1>
      <p className="mt-2 text-sm font-medium text-[color:var(--muted)]">
        ログイン中に提案された行き先は、自動でここに保存されます。
      </p>

      {!enabled && (
        <p className="mt-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6 text-sm font-medium text-[color:var(--muted)]">
          アカウント機能は現在設定されていません。
        </p>
      )}

      {enabled && !loading && !user && (
        <div className="mt-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-8 text-center">
          <p className="text-sm font-medium text-[color:var(--muted)]">
            ログインすると、生成した行き先がここに保存されます。
          </p>
          <button
            type="button"
            onClick={() => signInWithGoogle().catch(() => {})}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            Googleでログイン
          </button>
        </div>
      )}

      {enabled && user && (
        <div className="mt-8">
          {journeys === null && (
            <p className="text-sm font-medium text-[color:var(--muted)]">
              読み込み中…
            </p>
          )}

          {journeys !== null && journeys.length === 0 && (
            <p className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6 text-sm font-medium text-[color:var(--muted)]">
              まだ保存された旅はありません。ホームで行き先を見つけてみよう。
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {(journeys ?? []).map((journey) => (
              <article
                key={journey.id}
                className="overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)]"
              >
                <div
                  className="h-36 bg-cover bg-center"
                  style={{
                    backgroundImage: `url('${journey.destination.imageUrl ?? "/travel-backdrop.png"}')`,
                  }}
                />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black leading-snug">
                        {journey.destination.name}
                      </h2>
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[color:var(--muted)]">
                        <MapPin size={13} />
                        {journey.prefecture.nameJa} ・ {journey.distanceKm}km
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(journey.id)}
                      aria-label="削除"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-vermilion/10 hover:text-vermilion"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-vermilion/10 px-2.5 py-1 text-[11px] font-bold text-vermilion">
                      {transportLabel(journey.transport, journey.transfer)}
                    </span>
                    {journey.destination.categories.slice(0, 2).map((category) => (
                      <span
                        key={category}
                        className="rounded-full bg-forest/10 px-2.5 py-1 text-[11px] font-bold text-forest dark:bg-[#8fd0b9]/10 dark:text-[#8fd0b9]"
                      >
                        {categoryLabels[category]}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs font-bold">
                    <span className="text-[color:var(--muted)]">
                      片道 {formatMinutes(journey.estimatedTravelTime)} ・{" "}
                      {journey.people}名 {formatYen(journey.estimatedBudget.total)}
                    </span>
                    <a
                      href={googleMapsSearchUrl(journey.destination)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-forest dark:text-[#8fd0b9]"
                    >
                      地図
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
