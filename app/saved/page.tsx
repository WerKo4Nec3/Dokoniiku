"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  MapPin,
  RotateCcw,
  Route,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  deleteUserJourney,
  fetchUserJourneys,
  setJourneyVisited,
} from "@/lib/api/savedJourneys";
import {
  categoryLabels,
  formatMinutes,
  formatYen,
  googleMapsRouteUrl,
  googleMapsSearchUrl,
  orderByNearest,
  transportLabel,
} from "@/lib/utils/travel";
import { JapanTileMap } from "@/components/JapanTileMap";
import type { DestinationCategory, SavedJourney } from "@/types";

const allCategories = Object.keys(categoryLabels) as DestinationCategory[];

export default function SavedPage() {
  const { enabled, loading, user, signInWithGoogle } = useAuth();
  // null = not loaded yet (shows the loading state).
  const [journeys, setJourneys] = useState<SavedJourney[] | null>(null);
  const [prefectureFilter, setPrefectureFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<DestinationCategory | null>(null);
  const [visitedOnly, setVisitedOnly] = useState(false);

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

  // Filter options only for values that actually appear in the saved list.
  const prefectureOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const journey of journeys ?? []) {
      seen.set(journey.prefecture.id, journey.prefecture.nameJa);
    }
    return [...seen.entries()].map(([id, nameJa]) => ({ id, nameJa }));
  }, [journeys]);

  const categoryOptions = useMemo(() => {
    const seen = new Set<DestinationCategory>();
    for (const journey of journeys ?? []) {
      for (const category of journey.destination.categories) seen.add(category);
    }
    return allCategories.filter((category) => seen.has(category));
  }, [journeys]);

  const filtered = useMemo(
    () =>
      (journeys ?? []).filter(
        (journey) =>
          (!prefectureFilter || journey.prefecture.id === prefectureFilter) &&
          (!categoryFilter ||
            journey.destination.categories.includes(categoryFilter)) &&
          (!visitedOnly || journey.visited),
      ),
    [journeys, prefectureFilter, categoryFilter, visitedOnly],
  );

  const filtersActive =
    prefectureFilter !== null || categoryFilter !== null || visitedOnly;

  const savedPrefectureIds = useMemo(
    () => new Set((journeys ?? []).map((journey) => journey.prefecture.id)),
    [journeys],
  );
  const visitedPrefectureIds = useMemo(
    () =>
      new Set(
        (journeys ?? [])
          .filter((journey) => journey.visited)
          .map((journey) => journey.prefecture.id),
      ),
    [journeys],
  );
  const visitedCount = useMemo(
    () => (journeys ?? []).filter((journey) => journey.visited).length,
    [journeys],
  );

  // With a prefecture selected and 2+ places in it, offer one combined
  // Google Maps route through all of them (nearest-neighbour order).
  const routeUrl = useMemo(() => {
    if (!prefectureFilter || filtered.length < 2) return null;
    const origin = filtered[0].start;
    const ordered = orderByNearest(
      filtered.map((journey) => journey.destination),
      origin,
    );
    return googleMapsRouteUrl([origin, ...ordered]);
  }, [prefectureFilter, filtered]);

  async function handleDelete(id: string) {
    if (!user) return;
    setJourneys((current) =>
      current ? current.filter((item) => item.id !== id) : current,
    );
    await deleteUserJourney(user.uid, id).catch(() => {});
  }

  async function toggleVisited(journey: SavedJourney) {
    if (!user) return;
    const next = !journey.visited;
    setJourneys((current) =>
      current
        ? current.map((item) =>
            item.id === journey.id ? { ...item, visited: next } : item,
          )
        : current,
    );
    await setJourneyVisited(user.uid, journey.id, next).catch(() => {});
  }

  const chipClass = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-bold transition ${
      active
        ? "border-vermilion bg-vermilion/10 text-vermilion"
        : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
    }`;

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-5xl px-4 pb-20 pt-24 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
      >
        <ArrowLeft size={16} />
        旅にもどる
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="mt-4 text-3xl font-black sm:text-4xl">保存した旅</h1>
        <p className="mt-2 text-sm font-medium text-[color:var(--muted)]">
          保存した行き先のコレクション。次の旅のヒントに。
        </p>
      </motion.div>

      {!enabled && (
        <p className="mt-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6 text-sm font-medium text-[color:var(--muted)]">
          アカウント機能は現在設定されていません。
        </p>
      )}

      {enabled && !loading && !user && (
        <div className="mt-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-8 text-center">
          <p className="text-sm font-medium text-[color:var(--muted)]">
            ログインすると、保存した行き先がここに表示されます。
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

          {journeys !== null && journeys.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 flex flex-col items-start justify-between gap-6 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6 sm:flex-row sm:items-center"
            >
              <div>
                <h2 className="text-sm font-black">旅の記録</h2>
                <p className="mt-3 text-3xl font-black">
                  {visitedPrefectureIds.size}
                  <span className="text-base font-bold text-[color:var(--muted)]">
                    {" "}
                    / 47 都道府県
                  </span>
                </p>
                <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
                  行った場所 {visitedCount}件 ・ 保存 {journeys.length}件
                </p>
                <p className="mt-3 flex items-center gap-3 text-[11px] font-bold text-[color:var(--muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-vermilion" />
                    行った
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-forest/50 dark:bg-[#8fd0b9]/50" />
                    保存済み
                  </span>
                </p>
              </div>
              <JapanTileMap
                savedIds={savedPrefectureIds}
                visitedIds={visitedPrefectureIds}
              />
            </motion.div>
          )}

          {journeys !== null && journeys.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setVisitedOnly((value) => !value)}
                className={chipClass(visitedOnly)}
              >
                ✓ 行った場所
              </button>
              <span className="mx-1 h-4 w-px bg-[color:var(--line)]" />
              {prefectureOptions.length > 1 &&
                prefectureOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setPrefectureFilter((current) =>
                        current === option.id ? null : option.id,
                      )
                    }
                    className={chipClass(prefectureFilter === option.id)}
                  >
                    {option.nameJa}
                  </button>
                ))}
              {prefectureOptions.length > 1 && categoryOptions.length > 1 && (
                <span className="mx-1 h-4 w-px bg-[color:var(--line)]" />
              )}
              {categoryOptions.length > 1 &&
                categoryOptions.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() =>
                      setCategoryFilter((current) =>
                        current === category ? null : category,
                      )
                    }
                    className={chipClass(categoryFilter === category)}
                  >
                    {categoryLabels[category]}
                  </button>
                ))}
              {filtersActive && (
                <button
                  type="button"
                  onClick={() => {
                    setPrefectureFilter(null);
                    setCategoryFilter(null);
                    setVisitedOnly(false);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[color:var(--muted)] underline-offset-2 transition hover:text-[color:var(--foreground)] hover:underline"
                >
                  <RotateCcw size={12} />
                  クリア
                </button>
              )}
            </div>
          )}

          {routeUrl && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <a
                href={routeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
              >
                <Route size={16} />
                この{filtered.length}か所を1つのルートで開く
                <ExternalLink size={14} />
              </a>
            </motion.div>
          )}

          {journeys !== null && journeys.length > 0 && filtered.length === 0 && (
            <p className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6 text-sm font-medium text-[color:var(--muted)]">
              この条件に合う保存済みの旅はありません。
            </p>
          )}

          <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((journey) => (
                <motion.article
                  layout
                  key={journey.id}
                  initial={{ opacity: 0, y: 20, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 260, damping: 24 }}
                  whileHover={{ y: -4 }}
                  className="group overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] shadow-float"
                >
                  <div className="relative h-36 overflow-hidden bg-forest/10">
                    {journey.destination.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={journey.destination.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-forest/50 dark:text-[#8fd0b9]/50">
                        <MapPin size={30} />
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
                      {journey.prefecture.nameJa}
                    </span>
                    {journey.visited && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-vermilion px-2.5 py-1 text-[11px] font-black text-white">
                        <Check size={11} strokeWidth={3} />
                        行った
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base font-black leading-snug">
                        {journey.destination.name}
                      </h2>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleVisited(journey)}
                          aria-label={
                            journey.visited ? "未訪問にする" : "行ったに変更"
                          }
                          title={journey.visited ? "未訪問にする" : "行った！"}
                          className={`grid h-8 w-8 place-items-center rounded-full transition ${
                            journey.visited
                              ? "bg-vermilion/15 text-vermilion"
                              : "text-[color:var(--muted)] hover:bg-forest/10 hover:text-forest dark:hover:text-[#8fd0b9]"
                          }`}
                        >
                          <Check size={15} strokeWidth={3} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(journey.id)}
                          aria-label="削除"
                          className="grid h-8 w-8 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-vermilion/10 hover:text-vermilion"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-vermilion/10 px-2.5 py-1 text-[11px] font-bold text-vermilion">
                        {transportLabel(journey.transport, journey.transfer)}
                      </span>
                      {journey.destination.categories
                        .slice(0, 2)
                        .map((category) => (
                          <span
                            key={category}
                            className="rounded-full bg-forest/10 px-2.5 py-1 text-[11px] font-bold text-forest dark:bg-[#8fd0b9]/10 dark:text-[#8fd0b9]"
                          >
                            {categoryLabels[category]}
                          </span>
                        ))}
                    </div>

                    <dl className="mt-4 space-y-1 text-xs font-bold text-[color:var(--muted)]">
                      <div className="flex justify-between">
                        <dt>{journey.start.name}から</dt>
                        <dd>
                          約{journey.distanceKm}km ・{" "}
                          {formatMinutes(journey.estimatedTravelTime)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="inline-flex items-center gap-1">
                          <Users size={12} />
                          {journey.people}名
                        </dt>
                        <dd>{formatYen(journey.estimatedBudget.total)}</dd>
                      </div>
                    </dl>

                    <a
                      href={googleMapsSearchUrl(journey.destination)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-forest transition hover:opacity-80 dark:text-[#8fd0b9]"
                    >
                      Google Mapsで見る
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </section>
  );
}
