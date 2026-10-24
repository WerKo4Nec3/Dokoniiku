"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Footprints, Loader2, MapPin, MapPinCheck, NotebookPen, Radar } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { CabinetHeader } from "@/components/CabinetHeader";
import { openAuthDialog } from "@/components/AuthDialog";
import { TripRecordDialog } from "@/components/trip/TripRecordDialog";
import { DEFAULT_START } from "@/data/prefectures";
import { TRAVEL_EVENTS } from "@/data/events";
import {
  MAX_ACCURACY_M,
  buildCandidates,
  locate,
  nearbyNotable,
  performCheckIn,
  type Candidate,
  type NearbyPlace,
  type Position,
} from "@/lib/checkin";
import { useUserJourneys } from "@/lib/hooks/cabinet";
import { storeActiveTrip } from "@/lib/storage/activeTrip";
import {
  getStartPointSnapshot,
  parseStartPointSnapshot,
  subscribeStartPoint,
} from "@/lib/storage/startPoint";
import { useActiveTrip } from "@/lib/trips";
import { isVerifiedVisit } from "@/lib/utils/travel";
import type { ActiveTrip, SavedJourney } from "@/types";

const distance = (km: number) => (km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`);
const shortDate = (iso: string) =>
  new Date(iso).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function CheckInPage() {
  const { enabled, loading, user, journeys, setJourneys } = useUserJourneys();
  const trip = useActiveTrip();
  const startSnapshot = useSyncExternalStore(subscribeStartPoint, getStartPointSnapshot, () => "");
  const start = parseStartPointSnapshot(startSnapshot) ?? DEFAULT_START;
  const [position, setPosition] = useState<Position | null>(null);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [stamp, setStamp] = useState<{ journey: SavedJourney; firstVerified: boolean; isTrip: boolean } | null>(null);
  const [record, setRecord] = useState<{ trip: ActiveTrip; endsTrip: boolean } | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  async function findMe() {
    setLocating(true);
    setError(null);
    try {
      const pos = await locate();
      setPosition(pos);
      setNow(new Date());
      setPlaces(await nearbyNotable(pos.lat, pos.lon));
    } catch (err) {
      setError(err instanceof Error ? err.message : "現在地を取得できませんでした。");
    } finally {
      setLocating(false);
    }
  }

  const candidates = useMemo(
    () =>
      position && now
        ? buildCandidates(position, journeys ?? [], places, TRAVEL_EVENTS, now)
        : { here: [], near: [] },
    [position, journeys, places, now],
  );
  const precise = position ? position.accuracy <= MAX_ACCURACY_M : false;

  async function checkIn(candidate: Candidate) {
    if (!user || busyKey) return;
    setBusyKey(candidate.key);
    setError(null);
    try {
      const before = candidate.target.kind === "saved" ? candidate.target.journey : null;
      const journey = await performCheckIn(user.uid, candidate.target, start);
      setJourneys((list) => {
        const rest = (list ?? []).filter((item) => item.id !== journey.id);
        return [journey, ...rest];
      });
      // Checking in at the open trip's place counts as arriving there.
      const isTrip = Boolean(trip && trip.journey.destination.id === journey.destination.id);
      if (trip && isTrip && !trip.arrivedAt) {
        storeActiveTrip({ ...trip, arrivedAt: new Date().toISOString(), verified: true });
      }
      setStamp({ journey, firstVerified: !before || !isVerifiedVisit(before), isTrip });
    } catch {
      setError("チェックインできませんでした。通信を確認して、もう一度試してね。");
    } finally {
      setBusyKey(null);
    }
  }

  function writeRecord() {
    if (!stamp) return;
    const at = stamp.journey.checkIns?.at(-1) ?? new Date().toISOString();
    setRecord(
      stamp.isTrip && trip
        ? { trip: { ...trip, arrivedAt: trip.arrivedAt ?? at, verified: true }, endsTrip: true }
        : { trip: { journey: stamp.journey, startedAt: at, arrivedAt: at, verified: true }, endsTrip: false },
    );
    setStamp(null);
  }

  const history = useMemo(
    () =>
      (journeys ?? [])
        .filter((journey) => journey.checkIns?.length)
        .sort((a, b) => (b.checkIns!.at(-1) ?? "").localeCompare(a.checkIns!.at(-1) ?? ""))
        .slice(0, 8),
    [journeys],
  );

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-4 pb-20 pt-32 sm:px-6">
      <CabinetHeader
        eyebrow="現地チェックイン"
        title="チェックイン"
        subtitle="いま居る場所で、現地認証のスタンプ。保存した旅・クエストの名所・近くの名所で使えるよ。"
        mascot="pointing"
        accent="vermilion"
      />

      {!loading && enabled && !user ? (
        <button type="button" onClick={openAuthDialog} className="scene-cta mt-6 w-full justify-center">
          ログインしてチェックイン
        </button>
      ) : (
        <>
          <div className="mt-6 flex flex-col items-center rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 py-8">
            <div className="relative grid h-52 w-52 place-items-center">
              {[0, 1, 2].map((ring) => (
                <motion.span
                  key={ring}
                  className="absolute inset-0 rounded-full border-2 border-vermilion/40"
                  animate={locating ? { scale: [0.55, 1.15], opacity: [0.8, 0] } : { scale: 0.75, opacity: 0.25 }}
                  transition={
                    locating
                      ? { duration: 1.8, repeat: Infinity, delay: ring * 0.6, ease: "easeOut" }
                      : { duration: 0.4 }
                  }
                />
              ))}
              <motion.button
                type="button"
                onClick={() => void findMe()}
                disabled={locating}
                whileTap={{ scale: 0.95 }}
                className="relative grid h-36 w-36 place-items-center rounded-full bg-vermilion text-white shadow-[0_16px_34px_-12px_rgb(var(--c-vermilion)/0.8)]"
              >
                <span className="flex flex-col items-center gap-1.5 text-sm font-bold tracking-[0.12em]">
                  {locating ? <Loader2 size={28} className="animate-spin" /> : <Radar size={30} />}
                  {locating ? "さがし中…" : position ? "もう一度" : "現在地をさがす"}
                </span>
              </motion.button>
            </div>
            {position && (
              <p className={`mt-4 text-xs font-bold ${precise ? "text-[color:var(--muted)]" : "text-vermilion"}`}>
                位置の精度 ±{distance(position.accuracy / 1000)}
                {!precise && "・精度が低いので認証できません。屋外で、もう一度試してね。"}
              </p>
            )}
            {error && <p className="mt-3 text-center text-xs font-bold text-[color:var(--brand-ink)]">{error}</p>}
            {!position && !error && (
              <p className="mt-4 text-center text-xs text-[color:var(--muted)]">
                位置情報は、このチェックインのためだけに使います。
              </p>
            )}
          </div>

          {position && (
            <div className="mt-6 space-y-6">
              <div>
                <h2 className="text-sm font-black">ここにいる！</h2>
                {candidates.here.length === 0 ? (
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    近くにチェックインできる場所が見つかりませんでした。
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {candidates.here.map((candidate) => (
                      <li
                        key={candidate.key}
                        className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-3"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-vermilion/10 text-vermilion">
                          <MapPin size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{candidate.name}</span>
                          <span className="block truncate text-[11px] text-[color:var(--muted)]">
                            {candidate.subtitle}・{distance(candidate.km)}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => void checkIn(candidate)}
                          disabled={!precise || candidate.doneToday || busyKey !== null}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-vermilion px-4 py-2 text-xs font-bold text-white transition disabled:opacity-40"
                        >
                          {busyKey === candidate.key ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : candidate.doneToday ? (
                            <Check size={14} />
                          ) : (
                            <MapPinCheck size={14} />
                          )}
                          {candidate.doneToday ? "今日は済み" : "チェックイン"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {candidates.near.length > 0 && (
                <div>
                  <h2 className="text-sm font-black">もう少し</h2>
                  <ul className="mt-3 space-y-2">
                    {candidates.near.map((candidate) => (
                      <li
                        key={candidate.key}
                        className="flex items-center gap-3 rounded-2xl border border-dashed border-[color:var(--line)] p-3"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{candidate.name}</span>
                          <span className="block truncate text-[11px] text-[color:var(--muted)]">{candidate.subtitle}</span>
                        </span>
                        <span className="shrink-0 text-xs font-bold text-[color:var(--muted)]">
                          あと{distance(candidate.km - candidate.radiusKm)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {history.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-black">チェックインの記録</h2>
              <ul className="mt-3 divide-y divide-[color:var(--line)] rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)]">
                {history.map((journey) => (
                  <li key={journey.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid h-9 w-9 shrink-0 rotate-[-8deg] place-items-center rounded-full border-2 border-double border-[#c0392b] text-[9px] font-black leading-none text-[#c0392b]">
                      認証
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{journey.destination.name}</span>
                      <span className="block text-[11px] text-[color:var(--muted)]">
                        {journey.prefecture.nameJa}・{shortDate(journey.checkIns!.at(-1)!)}
                      </span>
                    </span>
                    {journey.checkIns!.length > 1 && (
                      <span className="shrink-0 text-xs font-black text-vermilion">×{journey.checkIns!.length}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {stamp && (
          <motion.div
            className="fixed inset-0 z-[2000] grid place-items-center bg-black/55 p-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-full max-w-sm rounded-[28px] bg-[color:var(--surface)] p-6 text-center shadow-2xl"
            >
              <motion.div
                initial={{ scale: 2.4, rotate: -30, opacity: 0 }}
                animate={{ scale: 1, rotate: -8, opacity: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.15 }}
                className="mx-auto grid h-36 w-36 place-items-center rounded-full border-[6px] border-double border-[#c0392b] bg-[#c0392b]/5 text-[#c0392b]"
              >
                <span className="px-3 font-display leading-tight">
                  <span className="block text-xs font-black tracking-[0.3em]">現地認証</span>
                  <span className="mt-1 block text-base font-black">{stamp.journey.destination.name.slice(0, 10)}</span>
                  <span className="mt-1 block text-[10px] font-bold">
                    {new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" })}
                  </span>
                </span>
              </motion.div>
              <p className="mt-5 text-lg font-bold">チェックインしました！</p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {stamp.journey.destination.name}を「完了」にして、御朱印帳に押しました。
              </p>
              {stamp.firstVerified && (
                <span className="mt-3 inline-block rounded-full bg-sun/25 px-3 py-1 text-xs font-black text-[#7a5a05] dark:text-sun">
                  +40 XP 現地ボーナス
                </span>
              )}
              <div className="mt-5 flex flex-col gap-2">
                {stamp.isTrip ? (
                  <Link href="/travel" className="scene-cta justify-center">
                    <Footprints size={16} /> 旅のページで散策をはじめる
                  </Link>
                ) : (
                  <button type="button" onClick={writeRecord} className="scene-cta justify-center">
                    <NotebookPen size={16} /> 旅の記録を書く
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStamp(null)}
                  className="py-2 text-sm font-bold text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                >
                  あとで
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {record && (
        <TripRecordDialog
          trip={record.trip}
          open
          endsTrip={record.endsTrip}
          onClose={() => setRecord(null)}
        />
      )}
    </section>
  );
}
