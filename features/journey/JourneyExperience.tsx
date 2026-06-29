"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bike,
  Car,
  Cloud,
  CloudRain,
  ExternalLink,
  Footprints,
  House,
  Info,
  LocateFixed,
  MapPin,
  RotateCcw,
  Snowflake,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Ticket,
  TrainFront,
  Users,
  Utensils,
  WalletCards,
  Wand2,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { DEFAULT_START, directions, prefectures } from "@/data/prefectures";
import { startPointPresets } from "@/data/startPoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getAttractionsByPrefecture } from "@/lib/api/places";
import { saveJourneyForUser } from "@/lib/api/savedJourneys";
import { getWeatherByCoordinates } from "@/lib/api/weather";
import { getDestinationSummary } from "@/lib/api/wikipedia";
import {
  getStartPointSnapshot,
  parseStartPointSnapshot,
  storeStartPoint,
  subscribeStartPoint,
} from "@/lib/storage/startPoint";
import {
  allTransportModes,
  bestTransport,
  categoryLabels,
  estimateBudget,
  estimateTravelTime,
  formatMinutes,
  formatYen,
  googleMapsSearchUrl,
  haversineDistanceKm,
  NEARBY_PREFECTURE_LIMIT_KM,
  pickDirection,
  pickPrefecture,
  randomItem,
  transportInfo,
  transportLabel,
} from "@/lib/utils/travel";
import type {
  Destination,
  DestinationCategory,
  Direction,
  JourneyResult,
  Prefecture,
  StartPoint,
  TransportMode,
  WeatherInfo,
} from "@/types";
import { ActionButton } from "@/components/ui/ActionButton";
import { TabiMascot } from "@/features/mascot/TabiMascot";
import { JourneySkeleton } from "./JourneySkeleton";
import { ProgressRail } from "./ProgressRail";

type Stage = "landing" | "direction" | "prefecture" | "loading" | "result";
type JourneyMode = "surprise" | "custom";
type TripLengthId = "day" | "one-night" | "two-night";

const allCategories = Object.keys(categoryLabels) as DestinationCategory[];

// Trip length → how long one-way travel may take (round trip is double).
const tripLengthOptions: {
  id: TripLengthId;
  labelJa: string;
  maxOneWayMinutes: number;
}[] = [
  { id: "day", labelJa: "日帰り", maxOneWayMinutes: 180 },
  { id: "one-night", labelJa: "1泊2日", maxOneWayMinutes: 360 },
  { id: "two-night", labelJa: "2泊3日", maxOneWayMinutes: 600 },
];

const transportIcons: Record<
  TransportMode,
  typeof Footprints
> = {
  walk: Footprints,
  bicycle: Bike,
  motorbike: Bike,
  car: Car,
  train: TrainFront,
  shinkansen: TrainFront,
};

const BUDGET_MIN = 5000;
const BUDGET_MAX = 100000;
const DISTANCE_MAX = 800;

const directionAngles: Record<Direction, number> = {
  北: 0,
  北東: 45,
  東: 90,
  南東: 135,
  南: 180,
  南西: 225,
  西: 270,
  北西: 315,
};

const reasonTexts = [
  "今日は少しだけ遠くへ。景色が変わると、気分もちゃんと切り替わるよ。",
  "予定を詰めすぎない旅にぴったり。寄り道の時間も残しておこう。",
  "自然と歴史をどちらも味わえる場所。歩きやすい靴で行こう。",
  "朝のうちに出発すれば、のんびり過ごしても余裕がありそう。",
];

function WeatherIcon({ weather }: { weather: WeatherInfo }) {
  const icons = {
    sun: Sun,
    cloud: Cloud,
    rain: CloudRain,
    snow: Snowflake,
  };
  const Icon = icons[weather.icon];
  return <Icon className="text-sky" size={28} aria-hidden="true" />;
}

function TransportIcon({
  mode,
  className,
  size = 21,
}: {
  mode: TransportMode;
  className?: string;
  size?: number;
}) {
  const Icon = transportIcons[mode];
  return <Icon size={size} className={className} aria-hidden="true" />;
}

export function JourneyExperience() {
  const [stage, setStage] = useState<Stage>("landing");
  const [direction, setDirection] = useState<Direction | null>(null);
  const [prefecture, setPrefecture] = useState<Prefecture | null>(null);
  const [journey, setJourney] = useState<JourneyResult | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [filterNotice, setFilterNotice] = useState<string | null>(null);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<DestinationCategory[]>([]);
  const [scope, setScope] = useState<"nearby" | "all">("nearby");
  const [people, setPeople] = useState(1);

  // "Подбор с настройками" (custom) mode.
  const [journeyMode, setJourneyMode] = useState<JourneyMode>("surprise");
  const [budget, setBudget] = useState(30000);
  const [tripLength, setTripLength] = useState<TripLengthId>("day");
  const [maxDistance, setMaxDistance] = useState(200);
  const [transports, setTransports] = useState<TransportMode[]>([
    "train",
    "car",
    "shinkansen",
  ]);
  const [allowTransfer, setAllowTransfer] = useState(false);

  const { user } = useAuth();

  const startSnapshot = useSyncExternalStore(
    subscribeStartPoint,
    getStartPointSnapshot,
    () => "",
  );
  const start = parseStartPointSnapshot(startSnapshot) ?? DEFAULT_START;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [stage]);

  function chooseStart(point: StartPoint) {
    storeStartPoint(point);
    setStartPickerOpen(false);
    setLocationError(null);
  }

  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocationError("この端末では現在地を取得できません。");
      return;
    }

    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        chooseStart({
          name: "現在地",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setLocationError("現在地を取得できませんでした。リストから選んでください。");
      },
      { timeout: 8000 },
    );
  }

  function toggleCategory(category: DestinationCategory) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  function resetFilters() {
    setSelectedCategories([]);
  }

  function toggleTransport(mode: TransportMode) {
    setTransports((current) =>
      current.includes(mode)
        ? current.filter((item) => item !== mode)
        : [...current, mode],
    );
  }

  const maxOneWayMinutes =
    tripLengthOptions.find((option) => option.id === tripLength)
      ?.maxOneWayMinutes ?? 180;

  const chipClass = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-bold transition ${
      active
        ? "border-vermilion bg-vermilion/10 text-vermilion"
        : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
    }`;

  function beginDirectionSelection() {
    setStage("direction");
    setDirection(null);
    setPrefecture(null);
    setJourney(null);
    setNotice(null);
    setFilterNotice(null);
    setSelecting(true);

    window.setTimeout(() => {
      setDirection(pickDirection());
      setSelecting(false);
    }, 1400);
  }

  function returnToStart() {
    setStage("landing");
    setDirection(null);
    setPrefecture(null);
    setJourney(null);
    setNotice(null);
    setFilterNotice(null);
    setSelecting(false);
  }

  function choosePrefecture() {
    if (!direction) return;
    let pool: Prefecture[];
    if (journeyMode === "custom") {
      // Custom: keep prefectures within the chosen max distance.
      pool = prefectures.filter(
        (item) => haversineDistanceKm(start, item) <= maxDistance,
      );
    } else if (scope === "all") {
      pool = prefectures;
    } else {
      pool = prefectures.filter(
        (item) =>
          haversineDistanceKm(start, item) <= NEARBY_PREFECTURE_LIMIT_KM,
      );
    }
    const next = pickPrefecture(direction, start, pool);
    setPrefecture(next);
    setFilterNotice(null);
    setStage("prefecture");
  }

  async function chooseDestination() {
    if (!direction || !prefecture) return;
    setNotice(null);
    setFilterNotice(null);

    // Fetch first so we can validate the filters before showing the loader.
    const places = await getAttractionsByPrefecture(prefecture, selectedCategories);
    const candidates = places.data;

    if (!candidates.length) {
      setFilterNotice(
        "選んだジャンルに合う場所が見つかりませんでした。ジャンルを変えるか、メインに戻って別の方角を試してみてね。",
      );
      setFiltersOpen(true);
      setStage("prefecture");
      return;
    }

    const isCustom = journeyMode === "custom";
    const usableModes: TransportMode[] = transports.length
      ? transports
      : ["train"];

    // Each plan pairs a destination with the transport it will use.
    type Plan = { destination: Destination; transport: TransportMode };
    let plans: Plan[];

    if (isCustom) {
      plans = [];
      for (const candidate of candidates) {
        const distance = haversineDistanceKm(start, candidate);
        if (distance > maxDistance) continue;
        const best = bestTransport({
          distanceKm: distance,
          categories: candidate.categories,
          people,
          modes: usableModes,
          transfer: allowTransfer,
          maxBudget: budget,
          maxOneWayMinutes,
        });
        if (!best) continue;
        plans.push({ destination: candidate, transport: best.mode });
      }

      if (!plans.length) {
        setFilterNotice(
          "設定した予算・時間・距離・移動手段に合う場所が見つかりませんでした。条件をゆるめるか、メインに戻って別の方角を試してね。",
        );
        setFiltersOpen(true);
        setStage("prefecture");
        return;
      }
    } else {
      plans = candidates.map((candidate) => ({
        destination: candidate,
        transport: "train" as TransportMode,
      }));
    }

    // When re-rolling, avoid showing the same place twice in a row.
    let pool = plans;
    if (journey && plans.length > 1) {
      const others = plans.filter(
        (plan) => plan.destination.id !== journey.destination.id,
      );
      if (others.length) pool = others;
    }

    setStage("loading");
    const startedAt = Date.now();
    const chosen = randomItem(pool);
    const picked = chosen.destination;
    const transport = chosen.transport;
    const transfer = isCustom ? allowTransfer : false;

    const [weather, summary] = await Promise.all([
      getWeatherByCoordinates(picked.latitude, picked.longitude),
      getDestinationSummary(picked.name),
    ]);
    const destination = summary
      ? {
          ...picked,
          description: summary.description,
          imageUrl: summary.imageUrl ?? picked.imageUrl,
        }
      : picked;
    const travel = estimateTravelTime(destination, start, transport, transfer);
    const budgetResult = estimateBudget(
      travel.distanceKm,
      destination.categories,
      people,
      transport,
      transfer,
    );
    const minimumWait = Math.max(0, 1100 - (Date.now() - startedAt));
    await new Promise((resolve) => window.setTimeout(resolve, minimumWait));

    const result: JourneyResult = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${destination.id}`,
      createdAt: new Date().toISOString(),
      direction,
      start,
      prefecture,
      destination,
      weather: weather.data,
      estimatedBudget: budgetResult,
      estimatedTravelTime: travel.minutes,
      distanceKm: travel.distanceKm,
      people,
      transport,
      transfer,
      isMock: places.provider === "mock" || weather.provider === "mock",
    };
    setJourney(result);
    setNotice([places.notice, weather.notice].filter(Boolean).join(" "));
    setStage("result");

    // Auto-save every generated place to the signed-in user's account.
    if (user) {
      saveJourneyForUser(user.uid, result).catch(() => {
        // Saving is best-effort; never block the result on a write failure.
      });
    }
  }

  const filtersActive = selectedCategories.length > 0;

  const filterPanel = (
    <div className="mt-6 border-t border-[color:var(--line)] pt-6">
      <button
        type="button"
        onClick={() => setFiltersOpen((open) => !open)}
        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
      >
        <SlidersHorizontal size={14} />
        ジャンルで絞る（任意）
        {filtersActive && (
          <span className="rounded-full bg-vermilion px-1.5 py-0.5 text-[10px] font-black text-white">
            設定中
          </span>
        )}
      </button>

      {filtersOpen && (
        <div className="mt-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-4">
          <p className="text-xs font-bold text-[color:var(--muted)]">
            気になるジャンル（複数選択可・未選択ならおまかせ）
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {allCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => toggleCategory(category)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  selectedCategories.includes(category)
                    ? "border-vermilion bg-vermilion/10 text-vermilion"
                    : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                }`}
              >
                {categoryLabels[category]}
              </button>
            ))}
          </div>

          {filtersActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--muted)] underline-offset-2 transition hover:text-[color:var(--foreground)] hover:underline"
            >
              <RotateCcw size={12} />
              ジャンルをクリア
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      {stage === "landing" && (
        <motion.section
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -16 }}
          className="hero-image relative flex min-h-[calc(100vh-4rem)] items-end overflow-hidden pt-16 md:items-center"
        >
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 pb-12 pt-[38vh] text-center sm:px-6 md:py-20">
            <div className="mb-2 flex justify-center">
              <TabiMascot mood="idle" />
            </div>
            <div className="mb-4 flex items-center justify-center gap-2 text-sm font-bold text-forest dark:text-[#8fd0b9]">
              <span className="h-px w-8 bg-current" />
              WEEKEND TRIP SELECTOR
              <span className="h-px w-8 bg-current" />
            </div>
            <h1 className="text-5xl font-black leading-[1.08] text-[color:var(--foreground)] sm:text-6xl">
              旅コンパス
              <span className="mt-3 block text-xl font-semibold text-[color:var(--muted)] sm:text-2xl">
                Tabi Compass
              </span>
            </h1>
            <p className="mt-6 max-w-md text-base font-medium leading-8 text-[color:var(--muted)] sm:text-lg">
              次の休日、どこへ行く？
              <br />
              旅の精タビに、方角から目的地まで任せよう。
            </p>
            <ActionButton
              onClick={beginDirectionSelection}
              icon={<Sparkles size={18} />}
              className="mt-8 w-full sm:w-auto"
            >
              旅をはじめる
            </ActionButton>

            <div className="mt-6 flex w-full flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setStartPickerOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
              >
                <MapPin size={14} />
                出発地点: {start.name}
              </button>

              {startPickerOpen && (
                <div className="w-full max-w-md rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
                  <button
                    type="button"
                    onClick={useCurrentLocation}
                    disabled={locating}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-forest/10 px-4 py-2.5 text-sm font-bold text-forest transition hover:bg-forest/15 disabled:opacity-60 dark:bg-[#8fd0b9]/10 dark:text-[#8fd0b9]"
                  >
                    <LocateFixed size={16} />
                    {locating ? "現在地を取得中…" : "現在地を使う"}
                  </button>
                  {locationError && (
                    <p className="mt-2 text-xs font-medium text-vermilion">
                      {locationError}
                    </p>
                  )}
                  <p className="mt-4 text-xs font-bold text-[color:var(--muted)]">
                    またはリストから選ぶ
                  </p>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {startPointPresets.map((point) => (
                      <button
                        key={point.name}
                        type="button"
                        onClick={() => chooseStart(point)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          start.name === point.name
                            ? "border-vermilion bg-vermilion/10 text-vermilion"
                            : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                        }`}
                      >
                        {point.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 inline-flex items-center gap-3 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--muted)]">
                <Users size={14} />
                人数
              </span>
              <div className="inline-flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPeople((n) => Math.max(1, n - 1))}
                  disabled={people <= 1}
                  aria-label="人数を減らす"
                  className="grid h-6 w-6 place-items-center rounded-full border border-[color:var(--line)] text-sm font-black text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)] disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-6 text-center text-sm font-black tabular-nums">
                  {people}
                </span>
                <button
                  type="button"
                  onClick={() => setPeople((n) => Math.min(20, n + 1))}
                  disabled={people >= 20}
                  aria-label="人数を増やす"
                  className="grid h-6 w-6 place-items-center rounded-full border border-[color:var(--line)] text-sm font-black text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)] disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-4 inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] p-1">
              <button
                type="button"
                onClick={() => setJourneyMode("surprise")}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  journeyMode === "surprise"
                    ? "bg-vermilion text-white"
                    : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                }`}
              >
                <Wand2 size={13} />
                驚かせて
              </button>
              <button
                type="button"
                onClick={() => setJourneyMode("custom")}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  journeyMode === "custom"
                    ? "bg-vermilion text-white"
                    : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                }`}
              >
                <SlidersHorizontal size={13} />
                設定して探す
              </button>
            </div>

            {journeyMode === "surprise" ? (
              <>
                <div className="mt-3 inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] p-1">
                  <button
                    type="button"
                    onClick={() => setScope("nearby")}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                      scope === "nearby"
                        ? "bg-vermilion text-white"
                        : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                    }`}
                  >
                    近場で探す
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope("all")}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                      scope === "all"
                        ? "bg-vermilion text-white"
                        : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                    }`}
                  >
                    全国から探す
                  </button>
                </div>
                <p className="mt-4 text-xs font-medium text-[color:var(--muted)]">
                  {scope === "nearby"
                    ? "出発地から日帰りで行ける範囲で、行き先をランダムに提案します"
                    : "全国47都道府県から、行き先をランダムに提案します"}
                </p>
              </>
            ) : (
              <>
                <div className="mt-4 w-full max-w-md rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-4 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[color:var(--muted)]">
                      予算（{people}名・上限）
                    </span>
                    <span className="text-xs font-black">{formatYen(budget)}</span>
                  </div>
                  <input
                    type="range"
                    min={BUDGET_MIN}
                    max={BUDGET_MAX}
                    step={1000}
                    value={budget}
                    onChange={(event) => setBudget(Number(event.target.value))}
                    className="mt-2 w-full accent-vermilion"
                  />

                  <p className="mt-4 text-xs font-bold text-[color:var(--muted)]">
                    旅の日数（移動できる時間）
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tripLengthOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTripLength(option.id)}
                        className={chipClass(tripLength === option.id)}
                      >
                        {option.labelJa}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs font-bold text-[color:var(--muted)]">
                      出発地からの距離（上限）
                    </span>
                    <span className="text-xs font-black">約{maxDistance}km</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={DISTANCE_MAX}
                    step={5}
                    value={maxDistance}
                    onChange={(event) => setMaxDistance(Number(event.target.value))}
                    className="mt-2 w-full accent-vermilion"
                  />

                  <p className="mt-4 text-xs font-bold text-[color:var(--muted)]">
                    移動手段（複数選択可）
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {allTransportModes.map((mode) => {
                      const Icon = transportIcons[mode];
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => toggleTransport(mode)}
                          className={`inline-flex items-center gap-1.5 ${chipClass(
                            transports.includes(mode),
                          )}`}
                        >
                          <Icon size={13} />
                          {transportInfo[mode].labelJa}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-[color:var(--muted)]">
                      乗り継ぎ（最後にタクシー等）を許可
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={allowTransfer}
                      aria-label="乗り継ぎを許可"
                      onClick={() => setAllowTransfer((value) => !value)}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                        allowTransfer ? "bg-vermilion" : "bg-[color:var(--line)]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                          allowTransfer ? "left-[18px]" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </div>
                <p className="mt-4 text-xs font-medium text-[color:var(--muted)]">
                  予算・時間・距離・移動手段に合う行き先だけを提案します
                </p>
              </>
            )}
          </div>
        </motion.section>
      )}

      {stage === "direction" && (
        <motion.section
          key="direction"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col justify-center px-5 py-24 sm:px-6"
        >
          <ProgressRail current={0} />
          <div className="mt-12 grid items-center gap-10 md:grid-cols-2">
            <div className="relative mx-auto grid h-72 w-72 place-items-center">
              <div className="absolute inset-0 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] shadow-float" />
              {directions.map((item) => {
                const angle = directionAngles[item];
                return (
                  <span
                    key={item}
                    className={`absolute text-sm font-bold transition ${
                      direction === item
                        ? "text-vermilion"
                        : "text-[color:var(--muted)]"
                    }`}
                    style={{
                      transform: `rotate(${angle}deg) translateY(-116px) rotate(-${angle}deg)`,
                    }}
                  >
                    {item}
                  </span>
                );
              })}
              <motion.div
                animate={
                  selecting
                    ? { rotate: 1080 }
                    : { rotate: direction ? directionAngles[direction] : 0 }
                }
                transition={{
                  duration: selecting ? 1.35 : 0.5,
                  ease: selecting ? "easeInOut" : "backOut",
                }}
                className="absolute bottom-1/2 left-1/2 h-20 w-2 -ml-1 origin-bottom rounded-full bg-vermilion"
              >
                <span className="absolute -left-2 -top-2 h-5 w-5 rotate-45 bg-vermilion" />
              </motion.div>
              <div className="z-10 grid h-16 w-16 place-items-center rounded-full border-4 border-[color:var(--surface)] bg-forest text-white shadow-lg">
                <Sparkles size={22} />
              </div>
            </div>

            <div className="text-center md:text-left">
              <div className="mx-auto md:mx-0">
                <TabiMascot
                  mood={selecting ? "thinking" : "reveal"}
                  size="small"
                />
              </div>
              <p className="mt-5 text-sm font-bold text-vermilion">
                STEP 01 / DIRECTION
              </p>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">
                {selecting
                  ? "タビが風を読んでいます…"
                  : `今日は「${direction}」へ！`}
              </h2>
              <p className="mt-4 leading-7 text-[color:var(--muted)]">
                {selecting
                  ? "どの方角になるかは、タビだけが知っています。"
                  : "この先にある都道府県から、次の行き先を選びます。"}
              </p>
              <ActionButton
                onClick={choosePrefecture}
                disabled={selecting || !direction}
                icon={<ArrowRight size={18} />}
                className="mt-7 w-full sm:w-auto"
              >
                この方角へ進む
              </ActionButton>
            </div>
          </div>
        </motion.section>
      )}

      {stage === "prefecture" && prefecture && (
        <motion.section
          key="prefecture"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col justify-center px-5 py-24 sm:px-6"
        >
          <ProgressRail current={1} />
          <div className="mt-10 overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-float sm:p-10">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-bold text-vermilion">
                STEP 02 / PREFECTURE
              </p>
              <span
                className="rounded-full px-3 py-1 text-xs font-bold text-white"
                style={{ backgroundColor: prefecture.accent }}
              >
                {prefecture.region}
              </span>
            </div>
            <div className="mt-8 flex items-end gap-3">
              <h2 className="text-4xl font-black sm:text-5xl">{prefecture.nameJa}</h2>
              <p className="pb-1 text-sm font-bold text-[color:var(--muted)]">
                {prefecture.nameEn}
              </p>
            </div>
            <p className="mt-5 max-w-md text-base font-medium leading-8 text-[color:var(--muted)]">
              {prefecture.shortDescriptionJa}
            </p>
            <div className="mt-8 flex items-start gap-3 border-t border-[color:var(--line)] pt-6">
              <TabiMascot mood="reveal" size="small" />
              <p className="pt-4 text-sm font-medium leading-7">
                「{direction}」の風が、ここまで連れてきたよ。
                <br />
                次は本当の目的地を探そう。
              </p>
            </div>

            {filterPanel}

            {filterNotice && (
              <div className="mt-5 flex items-start gap-2 rounded-lg border border-vermilion/40 bg-vermilion/10 px-4 py-3 text-xs font-medium leading-5">
                <Info size={16} className="mt-0.5 shrink-0 text-vermilion" />
                <span>{filterNotice}</span>
              </div>
            )}

            <ActionButton
              onClick={chooseDestination}
              icon={<Sparkles size={18} />}
              className="mt-6 w-full sm:w-auto"
            >
              目的地を決める
            </ActionButton>
            <button
              type="button"
              onClick={returnToStart}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] sm:ml-4"
            >
              <House size={13} />
              メインに戻る
            </button>
          </div>
        </motion.section>
      )}

      {stage === "loading" && (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="fixed inset-x-0 top-24 z-10 flex justify-center">
            <TabiMascot mood="thinking" size="small" />
          </div>
          <JourneySkeleton />
          <p className="fixed inset-x-0 top-52 z-10 text-center text-sm font-bold text-vermilion">
            タビが目的地と天気を調べています…
          </p>
        </motion.div>
      )}

      {stage === "result" && journey && (
        <motion.section
          key="result"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-4 py-24 sm:px-6"
        >
          <ProgressRail current={2} />

          <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-vermilion">
                TABI&apos;S PICK / 週末の行き先
              </p>
              <h2 className="mt-2 text-3xl font-black sm:text-5xl">
                {journey.destination.name}
              </h2>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-[color:var(--muted)]">
                <MapPin size={16} />
                {journey.prefecture.nameJa} ・ {journey.distanceKm}km
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-vermilion/10 px-3 py-1.5 text-xs font-bold text-vermilion">
                <TransportIcon mode={journey.transport} size={14} />
                {transportLabel(journey.transport, journey.transfer)}
              </span>
              {journey.destination.categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full bg-forest/10 px-3 py-1.5 text-xs font-bold text-forest dark:bg-[#8fd0b9]/10 dark:text-[#8fd0b9]"
                >
                  {categoryLabels[category]}
                </span>
              ))}
            </div>
          </div>

          {notice && (
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-sun/40 bg-sun/10 px-4 py-3 text-xs font-medium leading-5">
              <Info size={16} className="mt-0.5 shrink-0 text-[#9b7418]" />
              <span>{notice}</span>
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
            <div className="space-y-6">
              <div className="relative h-60 overflow-hidden rounded-lg sm:h-80">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url('${journey.destination.imageUrl ?? "/travel-backdrop.png"}')`,
                  }}
                />
              </div>

              <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6">
                <h3 className="text-sm font-black">この場所について</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-[color:var(--foreground)]">
                  {journey.destination.description}
                </p>
              </div>

              <div className="flex flex-col gap-4 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest/10 text-forest dark:bg-[#8fd0b9]/10 dark:text-[#8fd0b9]">
                    <MapPin size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-black">
                      {journey.destination.name}
                    </p>
                    <p className="text-xs font-medium text-[color:var(--muted)]">
                      {journey.prefecture.nameJa} ・ {journey.start.name}から約{journey.distanceKm}km
                    </p>
                  </div>
                </div>
                <a
                  href={googleMapsSearchUrl(journey.destination)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-5 text-sm font-bold transition hover:bg-[color:var(--surface-muted)]"
                >
                  Google Mapsで見る
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[color:var(--muted)]">
                      現地の天気
                    </p>
                    <p className="mt-2 text-3xl font-black">
                      {journey.weather.temperature}℃
                    </p>
                    <p className="mt-1 text-sm font-bold">
                      {journey.weather.description}
                    </p>
                  </div>
                  <WeatherIcon weather={journey.weather} />
                </div>
                <p className="mt-4 border-t border-[color:var(--line)] pt-4 text-xs font-medium leading-6 text-[color:var(--muted)]">
                  {journey.weather.advice}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
                  <TransportIcon
                    mode={journey.transport}
                    className="text-forest dark:text-[#8fd0b9]"
                  />
                  <p className="mt-4 text-xs font-bold text-[color:var(--muted)]">
                    片道の所要時間
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {formatMinutes(journey.estimatedTravelTime)}
                  </p>
                  <p className="mt-2 text-[10px] text-[color:var(--muted)]">
                    {transportLabel(journey.transport, journey.transfer)}での目安
                  </p>
                </div>
                <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
                  <WalletCards
                    size={21}
                    className="text-vermilion"
                  />
                  <p className="mt-4 text-xs font-bold text-[color:var(--muted)]">
                    予算の目安
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {formatYen(journey.estimatedBudget.total)}
                  </p>
                  <p className="mt-2 text-[10px] text-[color:var(--muted)]">
                    {journey.people}名・日帰り合計
                    {journey.people > 1 &&
                      `（1名あたり約${formatYen(
                        Math.round(journey.estimatedBudget.total / journey.people),
                      )}）`}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
                <h3 className="text-sm font-black">
                  費用の内訳
                  <span className="ml-1.5 text-xs font-bold text-[color:var(--muted)]">
                    （{journey.people}名分）
                  </span>
                </h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-2 text-[color:var(--muted)]">
                      <TrainFront size={16} /> 交通費（往復）
                    </dt>
                    <dd className="font-bold">
                      {formatYen(journey.estimatedBudget.transportCost)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-2 text-[color:var(--muted)]">
                      <Ticket size={16} /> 入場・体験
                    </dt>
                    <dd className="font-bold">
                      {formatYen(journey.estimatedBudget.activityCost)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-2 text-[color:var(--muted)]">
                      <Utensils size={16} /> 食事
                    </dt>
                    <dd className="font-bold">
                      {formatYen(journey.estimatedBudget.foodCost)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-[10px] text-[color:var(--muted)]">
                  費用は距離とカテゴリから算出した目安です。実際の料金を保証するものではありません。
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-forest p-5 text-white">
                <TabiMascot mood="reveal" size="small" />
                <div className="pt-3">
                  <p className="text-xs font-bold text-[#bfe7d8]">
                    タビのおすすめ理由
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6">
                    {randomItem(reasonTexts)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-[color:var(--line)] pt-8 sm:flex-row">
            <p className="text-sm font-medium text-[color:var(--muted)]">
              この行き先、どう？ 同じ{journey.prefecture.nameJa}で、別の場所も探せるよ。
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ActionButton
                onClick={chooseDestination}
                icon={<RotateCcw size={17} />}
              >
                別の場所にする
              </ActionButton>
              <button
                type="button"
                onClick={returnToStart}
                className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
              >
                <House size={15} />
                最初からやり直す
              </button>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
