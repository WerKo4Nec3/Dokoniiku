"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Compass,
  Flag,
  Footprints,
  Lightbulb,
  Loader2,
  LocateFixed,
  MapPinCheck,
  Navigation,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FoodPlace } from "@/app/api/food/route";
import { AccessCard } from "@/components/AccessCard";
import { PlaceRating } from "@/components/PlaceRating";
import type { AreaPoint } from "@/components/travel/AreaMap";
import { FoodCard } from "@/components/travel/FoodCard";
import { LiveWeatherCard } from "@/components/travel/LiveWeatherCard";
import { SightsCard } from "@/components/travel/SightsCard";
import { TripRecordForm } from "@/components/trip/TripRecordDialog";
import { FactsCard, NearbyCard } from "@/features/journey/PlaceSections";
import { TabiSprite } from "@/features/mascot/TabiSprite";
import { MAX_ACCURACY_M } from "@/lib/checkin";
import type { LiveWeather } from "@/lib/api/liveWeather";
import type { Sight } from "@/lib/api/sights";
import { upsertJourneyStatus } from "@/lib/api/trips";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  arrivalRadiusKm,
  checkArrival,
  directionsUrl,
  endTrip,
  etaMinutes,
  markArrived,
  setTripFinished,
  useActiveTrip,
  type ArrivalCheck,
} from "@/lib/trips";
import { tripTips } from "@/lib/tripTips";
import { displayPlaceName, formatMinutes, preciseDistanceKm, transportLabel } from "@/lib/utils/travel";
import type { JourneyResult } from "@/types";

const AreaMap = dynamic(() => import("@/components/travel/AreaMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[color:var(--surface-muted)]" />,
});

const aiEnabled = process.env.NEXT_PUBLIC_GEMINI_ENABLED === "true";
const STEPS = ["出発", "移動中", "到着", "散策", "完了"] as const;
const card = "rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5";
const clock = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};

type Position = { lat: number; lon: number; accuracy: number };

// 旅の途中: everything for the trip in one place — getting there (distance,
// weather every 5 min, tips, routes), being there (sights, area map, food),
// and finishing (rating, review, photos).
export default function TravelPage() {
  const trip = useActiveTrip();
  const { user } = useAuth();
  const [weather, setWeather] = useState<LiveWeather | null>(null);
  const [hour, setHour] = useState(12);
  const [position, setPosition] = useState<Position | null>(null);
  const [watching, setWatching] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<ArrivalCheck | null>(null);
  const [celebrate, setCelebrate] = useState<{ verified: boolean } | null>(null);
  const [sights, setSights] = useState<Sight[]>([]);
  const [food, setFood] = useState<FoodPlace[]>([]);
  const [ended, setEnded] = useState<JourneyResult | null>(null);
  const autoArrived = useRef(false);

  const phase = !trip ? "none" : trip.finishedAt ? "finish" : trip.arrivedAt ? "exploring" : "enroute";
  const step = phase === "enroute" ? 1 : phase === "exploring" ? 3 : 4;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase]);

  // Location: start right away when already allowed, otherwise on a tap.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (status.state === "granted") setWatching(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!watching || phase === "none" || phase === "finish") return;
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setPosition({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      (error) => {
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? "位置情報が許可されていません。"
            : "現在地を取得できませんでした。",
        );
        setWatching(false);
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [watching, phase]);

  const km =
    trip && position
      ? preciseDistanceKm({ latitude: position.lat, longitude: position.lon }, trip.journey.destination)
      : null;

  // Tabi notices when you've arrived (close enough, with a decent fix).
  useEffect(() => {
    if (!trip || phase !== "enroute" || km === null || !position || autoArrived.current) return;
    if (km <= arrivalRadiusKm(trip.journey) && position.accuracy <= MAX_ACCURACY_M) {
      autoArrived.current = true;
      void markArrived(trip, true, user?.uid).then(() => setCelebrate({ verified: true }));
    }
  }, [trip, phase, km, position, user]);

  async function arrive() {
    if (!trip) return;
    setChecking(true);
    setCheck(null);
    const result = await checkArrival(trip.journey);
    setChecking(false);
    if (result.kind === "here") {
      await markArrived(trip, true, user?.uid);
      setCelebrate({ verified: true });
    } else {
      setCheck(result);
    }
  }

  async function arriveAnyway() {
    if (!trip) return;
    await markArrived(trip, false, user?.uid);
    setCheck(null);
    setCelebrate({ verified: false });
  }

  async function endWithoutRecord() {
    if (!trip) return;
    const journey = trip.journey;
    if (user) await upsertJourneyStatus(user.uid, journey, "done").catch(() => {});
    endTrip();
    setEnded(journey);
  }

  function endAfterRecord() {
    if (!trip) return;
    const journey = trip.journey;
    endTrip();
    setEnded(journey);
  }

  if (!trip) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg flex-col items-center justify-center px-5 pb-16 pt-28 text-center">
        <TabiSprite pose={ended ? "camera" : "map"} className="aspect-[538/422] w-48" />
        {ended ? (
          <>
            <p className="mt-4 text-[11px] font-black tracking-[0.3em] text-vermilion">旅、完了！</p>
            <h1 className="mt-2 font-display text-3xl font-bold">おつかれさま！</h1>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
              {user
                ? `${displayPlaceName(ended.destination.name)}の旅を旅ノートに残しました。次はどこへ行こう？`
                : "ログインすると、旅の記録やスタンプを旅ノートに残せるよ。次はどこへ行こう？"}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link href="/" className="scene-cta justify-center">
                <Compass size={16} /> 次の旅をさがす
              </Link>
              <Link
                href="/saved"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--line)] px-6 py-3.5 text-sm font-bold"
              >
                旅ノートを見る
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-4 font-display text-2xl font-bold">いまは旅の途中ではありません</h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">行き先を決めて「ここに行く！」を押すと、ここが旅のページになるよ。</p>
            <Link href="/" className="scene-cta mt-6 justify-center">
              <Compass size={16} /> 行き先をさがす
            </Link>
          </>
        )}
      </section>
    );
  }

  const journey = trip.journey;
  const name = displayPlaceName(journey.destination.name);
  const tips = tripTips(journey, weather, phase === "enroute" ? "enroute" : "exploring", hour);
  const mapPoints: AreaPoint[] = [
    ...sights.map((sight) => ({
      id: `s-${sight.pageid}`,
      name: sight.name,
      latitude: sight.latitude,
      longitude: sight.longitude,
      kind: "sight" as const,
    })),
    ...food.map((place, i) => ({
      id: `f-${i}`,
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      kind: "food" as const,
    })),
    ...(position ? [{ id: "me", name: "あなた", latitude: position.lat, longitude: position.lon, kind: "me" as const }] : []),
  ];
  const stayMinutes =
    trip.arrivedAt && trip.finishedAt
      ? Math.max(1, Math.round((Date.parse(trip.finishedAt) - Date.parse(trip.arrivedAt)) / 60000))
      : null;

  return (
    <section className="relative z-0 mx-auto min-h-[calc(100vh-4rem)] max-w-5xl px-4 pb-20 pt-24 sm:px-6">
      {/* Backdrop: the destination's photo, softly blurred. */}
      {journey.destination.imageUrl && (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={journey.destination.imageUrl} alt="" className="h-full w-full scale-110 object-cover opacity-35 blur-2xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-[color:color-mix(in_srgb,var(--background)_40%,transparent)] to-[color:var(--background)]" />
        </div>
      )}

      <Link
        href="/tabi"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
      >
        <ArrowLeft size={14} /> タビパッド
      </Link>

      {/* Hero + progress */}
      <div className="scene-glass mt-3 overflow-clip rounded-[30px]">
        <div className="relative h-40 sm:h-52">
          {journey.destination.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={journey.destination.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-forest/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 text-white">
            <p className="text-[11px] font-black tracking-[0.3em] text-white/80">
              {phase === "enroute" ? "旅の途中" : phase === "exploring" ? "散策中" : "旅のしめくくり"}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{name}</h1>
            <p className="mt-1 text-xs font-bold text-white/80">
              {journey.prefecture.nameJa}・{clock(trip.startedAt)} 出発
              {trip.arrivedAt && `・${clock(trip.arrivedAt)} 到着`}
            </p>
          </div>
          {trip.verified && (
            <span className="absolute right-4 top-4 inline-flex rotate-[-8deg] items-center gap-1 rounded-md border-2 border-white/90 bg-vermilion/90 px-2 py-1 text-[11px] font-black text-white shadow">
              <MapPinCheck size={13} /> 現地認証
            </span>
          )}
        </div>
        <ol className="flex items-center gap-1 px-4 py-3 sm:px-6">
          {STEPS.map((label, index) => (
            <li key={label} className="flex flex-1 items-center gap-1">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${
                  index < step
                    ? "bg-vermilion text-white"
                    : index === step
                      ? "border-2 border-vermilion text-vermilion"
                      : "border border-[color:var(--line)] text-[color:var(--muted)]"
                }`}
              >
                {index < step ? <Check size={12} /> : index + 1}
              </span>
              <span className={`hidden text-[11px] font-bold sm:inline ${index === step ? "text-vermilion" : "text-[color:var(--muted)]"}`}>
                {label}
              </span>
              {index < STEPS.length - 1 && <span className="h-px flex-1 bg-[color:var(--line)]" />}
            </li>
          ))}
        </ol>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className={`mt-5 grid gap-4 ${phase === "finish" ? "mx-auto max-w-2xl" : "lg:grid-cols-[1.25fr_0.75fr]"}`}
        >
          {/* ---- Main column ---- */}
          <div className="min-w-0 space-y-4">
            {phase === "enroute" && (
              <div className={card}>
                <div className="flex items-center gap-4">
                  <TabiSprite pose="walking" className="aspect-[538/422] w-24 shrink-0" />
                  <div className="min-w-0">
                    {km !== null ? (
                      <>
                        <p className="text-[11px] font-black tracking-[0.2em] text-[color:var(--muted)]">目的地まで</p>
                        <p className="font-display text-4xl font-bold tabular-nums">
                          {km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`}
                        </p>
                        <p className="text-xs font-bold text-[color:var(--muted)]">
                          {transportLabel(journey.transport, journey.transfer)}で約{formatMinutes(etaMinutes(km, journey.transport))}（目安）
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-bold">位置情報をオンにすると、残りの距離がわかるよ</p>
                        <p className="mt-1 text-xs text-[color:var(--muted)]">着いたら、タビが自動で気づいてお知らせします。</p>
                        <button
                          type="button"
                          onClick={() => {
                            setGeoError(null);
                            setWatching(true);
                          }}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--line)] px-4 py-2 text-xs font-bold"
                        >
                          <LocateFixed size={14} className="text-vermilion" /> 位置情報をオンにする
                        </button>
                      </>
                    )}
                    {geoError && <p className="mt-2 text-xs font-bold text-[color:var(--brand-ink)]">{geoError}</p>}
                  </div>
                </div>

                {check && check.kind !== "here" && (
                  <div className="mt-4 rounded-2xl bg-[color:var(--surface-muted)] p-3 text-xs leading-5">
                    {check.kind === "far" ? `まだ目的地から約${check.km}km離れているみたい。` : check.reason}
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void arriveAnyway()}
                        className="rounded-full bg-[color:var(--surface)] px-3 py-1.5 font-bold"
                      >
                        到着したことにする
                      </button>
                      <button type="button" onClick={() => setCheck(null)} className="px-2 py-1.5 font-bold text-[color:var(--muted)]">
                        まだ移動中
                      </button>
                    </div>
                    <p className="mt-1.5 text-[10px] text-[color:var(--muted)]">
                      現地で到着を確認できると「現地認証」スタンプとボーナスXPがもらえます。
                    </p>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <a
                    href={directionsUrl(journey)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-3 text-sm font-bold"
                  >
                    <Navigation size={15} className="text-vermilion" /> ナビ
                  </a>
                  <button
                    type="button"
                    onClick={() => void arrive()}
                    disabled={checking}
                    className="scene-cta justify-center !px-3 !py-3 !tracking-[0.1em]"
                  >
                    {checking ? <Loader2 size={16} className="animate-spin" /> : <MapPinCheck size={16} />}
                    到着した！
                  </button>
                </div>
              </div>
            )}

            {phase === "exploring" && (
              <div className={`${card} flex flex-col gap-4 sm:flex-row sm:items-center`}>
                <TabiSprite pose="camera" className="aspect-[538/422] w-24 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black tracking-[0.2em] text-vermilion">到着！ {trip.arrivedAt && clock(trip.arrivedAt)}</p>
                  <p className="mt-1 text-sm leading-6">
                    {name}を思いきり楽しもう。見どころ・地図・ごはんを集めたよ。散策が終わったら「旅を終える」へ。
                  </p>
                </div>
                <button type="button" onClick={() => setTripFinished(trip, true)} className="scene-cta shrink-0 justify-center">
                  <Flag size={16} /> 旅を終える
                </button>
              </div>
            )}

            {phase === "finish" && (
              <>
                <div className={card}>
                  <p className="text-[11px] font-black tracking-[0.2em] text-vermilion">旅のしめくくり</p>
                  <h2 className="mt-1 font-display text-2xl font-bold">旅の思い出を残す？</h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    評価・ひとこと・写真、どれか一つでも。あとで旅ノートからも見返せるよ。
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    {stayMinutes && (
                      <span className="rounded-full bg-[color:var(--surface-muted)] px-3 py-1.5">
                        滞在 {formatMinutes(stayMinutes)}
                      </span>
                    )}
                    <span className="rounded-full bg-[color:var(--surface-muted)] px-3 py-1.5">
                      {trip.verified ? "📍 現地認証済み" : "現地認証なし"}
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)]">
                  <TripRecordForm trip={trip} onFinish={endAfterRecord} finishLabel="旅を終える" />
                </div>
                <PlaceRating placeId={journey.destination.id} name={journey.destination.name} prefecture={journey.prefecture.nameJa} />
                <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setTripFinished(trip, false)}
                    className="text-sm font-bold text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                  >
                    ← まだ散策する
                  </button>
                  <button
                    type="button"
                    onClick={() => void endWithoutRecord()}
                    className="rounded-full border border-[color:var(--line)] px-5 py-2.5 text-sm font-bold"
                  >
                    記録せずに旅を終える
                  </button>
                </div>
              </>
            )}

            {phase === "exploring" && (
              <>
                <SightsCard
                  latitude={journey.destination.latitude}
                  longitude={journey.destination.longitude}
                  exclude={[journey.destination.name, journey.destination.wikiTitle ?? ""]}
                  onSights={setSights}
                />
                <div className="relative h-80 overflow-hidden rounded-[24px] border border-[color:var(--line)] sm:h-96">
                  <AreaMap
                    latitude={journey.destination.latitude}
                    longitude={journey.destination.longitude}
                    name={name}
                    points={mapPoints}
                  />
                </div>
                <FoodCard
                  latitude={journey.destination.latitude}
                  longitude={journey.destination.longitude}
                  placeName={journey.destination.name}
                  onPlaces={setFood}
                />
                <FactsCard
                  name={journey.destination.name}
                  prefecture={journey.prefecture.nameJa}
                  categories={journey.destination.categories}
                  aiEnabled={aiEnabled}
                />
              </>
            )}
          </div>

          {/* ---- Side column ---- */}
          {phase !== "finish" && (
            <div className="min-w-0 space-y-4">
              <LiveWeatherCard
                latitude={journey.destination.latitude}
                longitude={journey.destination.longitude}
                onWeather={(value) => {
                  setWeather(value);
                  setHour(new Date().getHours());
                }}
              />
              {tips.length > 0 && (
                <div className={card}>
                  <h3 className="flex items-center gap-2 text-sm font-black">
                    <Lightbulb size={16} className="text-sun" /> タビのアドバイス
                  </h3>
                  <ul className="mt-3 space-y-2.5">
                    {tips.map((tip) => (
                      <li key={tip.text} className="flex gap-2.5 text-sm leading-6">
                        <span className="shrink-0">{tip.emoji}</span>
                        <span>{tip.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {phase === "enroute" ? (
                <AccessCard start={journey.start} destination={journey.destination} />
              ) : (
                <NearbyCard
                  placeName={journey.destination.name}
                  latitude={journey.destination.latitude}
                  longitude={journey.destination.longitude}
                />
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Arrival celebration */}
      <AnimatePresence>
        {celebrate && (
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
                initial={{ scale: 2.2, rotate: -30, opacity: 0 }}
                animate={{ scale: 1, rotate: -8, opacity: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.15 }}
                className={`mx-auto grid h-32 w-32 place-items-center rounded-full border-[6px] text-[#c0392b] ${
                  celebrate.verified ? "border-double border-[#c0392b] bg-[#c0392b]/5" : "border-[#c0392b]/60"
                }`}
              >
                <span className="font-display leading-tight">
                  <span className="block text-2xl font-black">到着</span>
                  {celebrate.verified && <span className="block text-[11px] font-black tracking-[0.2em]">現地認証</span>}
                </span>
              </motion.div>
              <p className="mt-5 text-lg font-bold">{name}に着いたよ！</p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">見どころ・地図・近くのごはんを集めておいたよ。</p>
              <button type="button" onClick={() => setCelebrate(null)} className="scene-cta mt-5 w-full justify-center">
                <Footprints size={16} /> 散策をはじめる
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
