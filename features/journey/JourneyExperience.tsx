"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Bike,
  Bookmark,
  Car,
  Castle,
  Check,
  ChevronRight,
  Church,
  Cloud,
  CloudRain,
  Droplets,
  ExternalLink,
  Footprints,
  House,
  Info,
  Landmark,
  Leaf,
  LocateFixed,
  MapPin,
  Mountain,
  RotateCcw,
  Share2,
  Shuffle,
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
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { DEFAULT_START, directions, prefectures } from "@/data/prefectures";
import { startPointPresets } from "@/data/startPoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getAttractionsByPrefecture } from "@/lib/api/places";
import {
  fetchRecentForUser,
  saveJourneyForUser,
  saveRecentForUser,
} from "@/lib/api/savedJourneys";
import { getWeatherByCoordinates } from "@/lib/api/weather";
import { getDestinationImages, getDestinationSummary } from "@/lib/api/wikipedia";
import {
  getRecentSnapshot,
  parseRecentSnapshot,
  pushRecentJourney,
  subscribeRecent,
} from "@/lib/storage/recentJourneys";
import {
  getStartPointSnapshot,
  parseStartPointSnapshot,
  storeStartPoint,
  subscribeStartPoint,
} from "@/lib/storage/startPoint";
import { buildShareCard } from "@/lib/share/shareCard";
import {
  allTransportModes,
  bestTransport,
  categoryLabels,
  CURRENT_SEASON,
  estimateBudget,
  estimateTravelTime,
  formatMinutes,
  formatYen,
  googleMapsSearchUrl,
  haversineDistanceKm,
  isSeasonalMatch,
  journeyDifficulty,
  NEARBY_PREFECTURE_LIMIT_KM,
  pickDirection,
  pickPrefecture,
  randomItem,
  seasonInfo,
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
import {
  DifficultyBadge,
  difficultyFrameClass,
} from "@/components/DifficultyBadge";
import { TabiMascot } from "@/features/mascot/TabiMascot";
import { ImageGallery } from "./ImageGallery";
import { JourneySkeleton } from "./JourneySkeleton";

// Leaflet touches `window`, so load the interactive map client-side only.
const PlaceMap = dynamic(() => import("./PlaceMap"), {
  ssr: false,
  loading: () => (
    <div className="h-60 w-full animate-pulse bg-[color:var(--surface-muted)]" />
  ),
});

type Stage =
  | "landing"
  | "direction"
  | "prefecture"
  | "shuffle"
  | "loading"
  | "result";
type JourneyMode = "surprise" | "custom";
type TripLengthId = "day" | "one-night" | "two-night";

// A destination paired with the transport that will be used to reach it.
type Plan = { destination: Destination; transport: TransportMode };

// Module-scope wrappers: these run only inside event handlers, but the
// react-hooks purity lint cannot see that through indirect calls.
const nowMs = () => Date.now();
const nowIso = () => new Date().toISOString();
function makeJourneyId(destinationId: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${nowMs()}-${destinationId}`;
}

function sampleItems<T>(items: T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

// Half the time, prefer places whose genre fits the current season
// (spring parks, winter onsen...); otherwise pick freely.
function pickPlanWithSeasonBoost(pool: Plan[]): Plan {
  const seasonal = pool.filter((plan) =>
    isSeasonalMatch(plan.destination.categories),
  );
  if (seasonal.length && Math.random() < 0.5) return randomItem(seasonal);
  return randomItem(pool);
}

// Shared entrance animation: parents stagger their fadeUp children.
const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

// Smoothly expands/collapses togglable panels.
function ExpandPanel({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className={`w-full overflow-hidden ${className ?? ""}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const allCategories = Object.keys(categoryLabels) as DestinationCategory[];

const categoryIcons: Record<DestinationCategory, LucideIcon> = {
  nature: Leaf,
  history: Castle,
  shrine: Church,
  museum: Landmark,
  "hot-spring": Droplets,
  food: Utensils,
  viewpoint: Mountain,
};

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
// The budget slider is a party-total cap, so its ceiling scales with the
// headcount — 20 people over a long distance can easily pass ¥1,000,000.
const BUDGET_PER_PERSON_MAX = 60000;
const DISTANCE_MAX = 800;
const SHUFFLE_COUNT = 4;

// Gemini-powered place insight is optional; the UI only appears when enabled.
const aiEnabled = process.env.NEXT_PUBLIC_GEMINI_ENABLED === "true";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  // Party-total budget cap grows with the headcount so large groups aren't
  // stuck under a fixed ¥100,000 ceiling that no plan can ever satisfy.
  const budgetMax = Math.max(BUDGET_MIN, BUDGET_PER_PERSON_MAX * people);
  const [savedJourneyId, setSavedJourneyId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState<string | null>(null);
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [shufflePool, setShufflePool] = useState<{
    plans: Plan[];
    providerMock: boolean;
    placesNotice?: string;
  } | null>(null);
  const [shuffleOptions, setShuffleOptions] = useState<Plan[]>([]);

  const { user, enabled: authEnabled, signInWithGoogle } = useAuth();

  const startSnapshot = useSyncExternalStore(
    subscribeStartPoint,
    getStartPointSnapshot,
    () => "",
  );
  const start = parseStartPointSnapshot(startSnapshot) ?? DEFAULT_START;

  const recentSnapshot = useSyncExternalStore(
    subscribeRecent,
    getRecentSnapshot,
    () => "[]",
  );
  const localRecent = parseRecentSnapshot(recentSnapshot);
  // When signed in, recent history syncs with the account (cloud); otherwise
  // it stays in localStorage. null = cloud not loaded yet.
  const [cloudRecent, setCloudRecent] = useState<JourneyResult[] | null>(null);
  const recentJourneys = user && cloudRecent ? cloudRecent : localRecent;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [stage]);

  // Keep the chosen budget within the (headcount-dependent) ceiling.
  useEffect(() => {
    setBudget((current) => Math.min(current, budgetMax));
  }, [budgetMax]);

  // The header logo taps back to the very start even when we're already on
  // "/" (where a same-route link wouldn't reset our internal stage).
  useEffect(() => {
    function goHome() {
      setStage("landing");
      setDirection(null);
      setPrefecture(null);
      setJourney(null);
      setNotice(null);
      setFilterNotice(null);
      setSelecting(false);
      setShufflePool(null);
      setShuffleOptions([]);
    }
    window.addEventListener("dokoniiku:go-home", goHome);
    return () => window.removeEventListener("dokoniiku:go-home", goHome);
  }, []);

  // A saved card clicked on /saved hands the journey over via
  // sessionStorage; reopen it here as the full result view.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = sessionStorage.getItem("dokoniiku:view-journey");
        if (!raw) return;
        sessionStorage.removeItem("dokoniiku:view-journey");
        const item = JSON.parse(raw) as JourneyResult;
        if (!item?.destination?.name || !item?.prefecture?.nameJa) return;
        setDirection(item.direction);
        setPrefecture(item.prefecture);
        setJourney(item);
        setStage("result");
      } catch {
        // corrupt handoff — stay on the landing
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // On sign-in, load the account's recent history and merge in any local
  // history made while signed out; keep the newest five, newest first.
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const cloud = await fetchRecentForUser(user.uid).catch(() => []);
      const local = parseRecentSnapshot(getRecentSnapshot());
      const merged = [
        ...cloud,
        ...local.filter((l) => !cloud.some((c) => c.id === l.id)),
      ]
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
        .slice(0, 5);
      if (!active) return;
      setCloudRecent(merged);
      if (merged.length > cloud.length) {
        saveRecentForUser(user.uid, merged).catch(() => {});
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

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
    setShufflePool(null);
    setShuffleOptions([]);
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

  // Fetch candidates and turn them into feasible plans. On an empty result,
  // shows the appropriate notice and returns null.
  async function buildPlans(): Promise<{
    plans: Plan[];
    providerMock: boolean;
    placesNotice?: string;
  } | null> {
    if (!prefecture) return null;
    setNotice(null);
    setFilterNotice(null);

    const places = await getAttractionsByPrefecture(prefecture, selectedCategories);
    const candidates = places.data;

    if (!candidates.length) {
      setFilterNotice(
        "選んだジャンルに合う場所が見つかりませんでした。ジャンルを変えるか、メインに戻って別の方角を試してみてね。",
      );
      setFiltersOpen(true);
      setStage("prefecture");
      return null;
    }

    let plans: Plan[];
    if (journeyMode === "custom") {
      const usableModes: TransportMode[] = transports.length
        ? transports
        : ["train"];
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
          "設定した条件に合う場所が見つかりませんでした。下の設定で予算・距離・時間・移動手段をゆるめて、もう一度さがしてみてね。",
        );
        setSettingsOpen(true);
        setStage("prefecture");
        return null;
      }
    } else {
      plans = candidates.map((candidate) => ({
        destination: candidate,
        transport: "train" as TransportMode,
      }));
    }

    return {
      plans,
      providerMock: places.provider === "mock",
      placesNotice: places.notice,
    };
  }

  // The loading → result flow for one chosen plan.
  async function finalizePlan(
    plan: Plan,
    providerMock: boolean,
    placesNotice?: string,
  ) {
    if (!direction || !prefecture) return;
    setStage("loading");
    const startedAt = nowMs();
    const picked = plan.destination;
    const transport = plan.transport;
    const transfer = journeyMode === "custom" ? allowTransfer : false;

    const [weather, summary, gallery] = await Promise.all([
      getWeatherByCoordinates(picked.latitude, picked.longitude),
      getDestinationSummary(picked.name),
      getDestinationImages(picked.name),
    ]);
    // Lead with the summary's hero image, then fill in the Commons gallery.
    const heroImage = summary?.imageUrl ?? picked.imageUrl;
    const images = [
      ...(heroImage ? [heroImage] : []),
      ...gallery.filter((url) => url !== heroImage),
    ];
    const destination = {
      ...picked,
      description: summary?.description ?? picked.description,
      imageUrl: heroImage,
      images,
    };
    const travel = estimateTravelTime(destination, start, transport, transfer);
    const budgetResult = estimateBudget(
      travel.distanceKm,
      destination.categories,
      people,
      transport,
      transfer,
    );
    const minimumWait = Math.max(0, 1100 - (nowMs() - startedAt));
    await new Promise((resolve) => window.setTimeout(resolve, minimumWait));

    const result: JourneyResult = {
      id: makeJourneyId(destination.id),
      createdAt: nowIso(),
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
      isMock: providerMock || weather.provider === "mock",
    };
    setJourney(result);
    setSavedJourneyId(null);
    setShareFeedback(false);
    setAiText(null);
    setAiPlan(null);
    setNotice([placesNotice, weather.notice].filter(Boolean).join(" "));
    setStage("result");

    // Keep a short history of the last few generated places: locally always,
    // and synced to the account when signed in.
    pushRecentJourney(result);
    if (user) {
      const base = cloudRecent ?? [];
      const nextRecent = [
        result,
        ...base.filter((item) => item.id !== result.id),
      ].slice(0, 5);
      setCloudRecent(nextRecent);
      saveRecentForUser(user.uid, nextRecent).catch(() => {});
    }
  }

  async function chooseDestination() {
    if (!direction || !prefecture) return;
    const built = await buildPlans();
    if (!built) return;

    // When re-rolling, avoid showing the same place twice in a row.
    let pool = built.plans;
    if (journey && pool.length > 1) {
      const others = pool.filter(
        (plan) => plan.destination.id !== journey.destination.id,
      );
      if (others.length) pool = others;
    }

    // With no genre chosen, gently favour places that fit the season.
    const picked = selectedCategories.length
      ? randomItem(pool)
      : pickPlanWithSeasonBoost(pool);
    await finalizePlan(picked, built.providerMock, built.placesNotice);
  }

  // Shuffle mode: deal a hand of candidate cards and let the user pick one.
  async function startShuffle() {
    if (!direction || !prefecture) return;
    const built = await buildPlans();
    if (!built) return;
    setShufflePool(built);
    setShuffleOptions(sampleItems(built.plans, SHUFFLE_COUNT));
    setStage("shuffle");
  }

  function reshuffle() {
    if (!shufflePool) return;
    setShuffleOptions((current) => {
      const shown = new Set(current.map((plan) => plan.destination.id));
      const fresh = shufflePool.plans.filter(
        (plan) => !shown.has(plan.destination.id),
      );
      // Prefer unseen places; top up from the full pool when running low.
      const next = sampleItems(fresh, SHUFFLE_COUNT);
      if (next.length < SHUFFLE_COUNT) {
        const rest = shufflePool.plans.filter(
          (plan) => !next.some((p) => p.destination.id === plan.destination.id),
        );
        next.push(...sampleItems(rest, SHUFFLE_COUNT - next.length));
      }
      return next;
    });
  }

  function chooseShuffleOption(plan: Plan) {
    if (!shufflePool) return;
    void finalizePlan(plan, shufflePool.providerMock, shufflePool.placesNotice);
  }

  async function handleAskAi() {
    if (!journey || aiLoading) return;
    setAiLoading(true);
    setAiText(null);
    try {
      const response = await fetch("/api/place-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: journey.destination.name,
          prefecture: journey.prefecture.nameJa,
          categories: journey.destination.categories,
        }),
      });
      const data = await response.json();
      setAiText(
        response.ok && data.text
          ? (data.text as string)
          : "AIの情報を取得できませんでした。少し時間をおいて試してみてね。",
      );
    } catch {
      setAiText("AIの情報を取得できませんでした。少し時間をおいて試してみてね。");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSaveCurrent() {
    if (!user || !journey) return;
    setSavedJourneyId(journey.id);
    try {
      await saveJourneyForUser(user.uid, journey);
    } catch {
      setSavedJourneyId(null); // saving failed — let the user retry
    }
  }

  function viewRecent(item: JourneyResult) {
    setDirection(item.direction);
    setPrefecture(item.prefecture);
    setJourney(item);
    setSavedJourneyId(null);
    setShareFeedback(false);
    setAiText(null);
    setAiPlan(null);
    setNotice(null);
    setFilterNotice(null);
    setStage("result");
  }

  async function handleShare() {
    if (!journey) return;
    const mapsUrl = googleMapsSearchUrl(journey.destination);
    const text = [
      `Dokoniikuのタビが選んだ行き先: ${journey.destination.name}（${journey.prefecture.nameJa}）`,
      `${journey.start.name}から約${journey.distanceKm}km ・ ${transportLabel(journey.transport, journey.transfer)}で片道${formatMinutes(journey.estimatedTravelTime)}`,
      `地図: ${mapsUrl}`,
    ].join("\n");
    const title = `Dokoniiku | ${journey.destination.name}`;

    try {
      // Pretty share card: photo + name + mascot + brand.
      const blob = await buildShareCard(journey).catch(() => null);
      const file = blob
        ? new File([blob], "dokoniiku.png", { type: "image/png" })
        : null;

      // Mobile with image support: share the card itself.
      if (
        file &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] }) &&
        typeof navigator.share === "function"
      ) {
        await navigator.share({ files: [file], title, text });
        return;
      }
      // Mobile without file sharing: plain share sheet.
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url: window.location.origin });
        return;
      }
      // Desktop: download the card and copy the text.
      if (blob) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `dokoniiku-${journey.destination.name}.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      }
      await navigator.clipboard.writeText(`${text}\n${window.location.origin}`);
      setShareFeedback(true);
      window.setTimeout(() => setShareFeedback(false), 2600);
    } catch {
      // user cancelled the share sheet — nothing to do
    }
  }

  async function handleAskPlan() {
    if (!journey || aiPlanLoading) return;
    setAiPlanLoading(true);
    setAiPlan(null);
    try {
      const response = await fetch("/api/place-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "plan",
          name: journey.destination.name,
          prefecture: journey.prefecture.nameJa,
          categories: journey.destination.categories,
          weather: journey.weather.description,
          temperature: journey.weather.temperature,
          transport: transportLabel(journey.transport, journey.transfer),
          travelMinutes: journey.estimatedTravelTime,
        }),
      });
      const data = await response.json();
      setAiPlan(
        response.ok && data.text
          ? (data.text as string)
          : "プランを作れませんでした。少し時間をおいて試してみてね。",
      );
    } catch {
      setAiPlan("プランを作れませんでした。少し時間をおいて試してみてね。");
    } finally {
      setAiPlanLoading(false);
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

      <ExpandPanel open={filtersOpen}>
        <div className="mt-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[color:var(--foreground)]">
                気になるジャンル
              </p>
              <p className="mt-0.5 text-xs font-medium text-[color:var(--muted)]">
                複数選択できます・未選択ならタビにおまかせ
              </p>
            </div>
            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-[color:var(--muted)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]"
              >
                <RotateCcw size={12} />
                クリア
              </button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {allCategories.map((category) => {
              const Icon = categoryIcons[category];
              const active = selectedCategories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleCategory(category)}
                  className={`group relative flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                    active
                      ? "border-vermilion bg-vermilion text-white shadow-sm shadow-vermilion/30"
                      : "border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:border-vermilion/50 hover:bg-vermilion/5"
                  }`}
                >
                  <Icon
                    size={17}
                    className={`shrink-0 transition ${
                      active ? "text-white" : "text-vermilion"
                    }`}
                  />
                  <span className="truncate">{categoryLabels[category]}</span>
                  {active && (
                    <Check size={15} className="ml-auto shrink-0 text-white" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </ExpandPanel>
    </div>
  );

  // Budget / time / distance / transport knobs. Shared between the landing
  // custom mode and the "loosen your settings" panel on the prefecture stage.
  const customKnobs = (
    <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-4 text-left">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[color:var(--muted)]">
          予算（{people}名・上限）
        </span>
        <span className="text-xs font-black">{formatYen(budget)}</span>
      </div>
      <input
        type="range"
        min={BUDGET_MIN}
        max={budgetMax}
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
  );

  return (
    <AnimatePresence mode="wait">
      {stage === "landing" && (
        <motion.section
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -16 }}
          className="hero-image relative flex min-h-[calc(100vh-4rem)] items-center overflow-hidden pt-16"
        >
          <motion.div
            variants={staggerParent}
            initial="hidden"
            animate="show"
            className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 py-12 text-center sm:px-6 md:py-20"
          >
            <motion.div variants={fadeUp} className="mb-2 flex justify-center">
              <TabiMascot mood="idle" />
            </motion.div>
            <motion.div
              variants={fadeUp}
              className="mb-4 flex items-center justify-center gap-2 text-sm font-bold text-forest dark:text-[#8fd0b9]"
            >
              <span className="h-px w-8 bg-current" />
              WEEKEND TRIP SELECTOR
              <span className="h-px w-8 bg-current" />
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="text-5xl font-black leading-[1.08] text-[color:var(--foreground)] sm:text-6xl"
            >
              旅コンパス
              <span className="mt-3 block text-xl font-semibold text-[color:var(--muted)] sm:text-2xl">
                Dokoniiku
              </span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-md text-base font-medium leading-8 text-[color:var(--muted)] sm:text-lg"
            >
              次の休日、どこへ行く？
              <br />
              旅の精タビに、方角から目的地まで任せよう。
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 w-full sm:w-auto">
              <ActionButton
                onClick={beginDirectionSelection}
                icon={<Sparkles size={18} />}
                className="w-full sm:w-auto"
              >
                旅をはじめる
              </ActionButton>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-6 flex w-full flex-col items-center gap-3"
            >
              <button
                type="button"
                onClick={() => setStartPickerOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
              >
                <MapPin size={14} />
                出発地点: {start.name}
              </button>

              <ExpandPanel open={startPickerOpen} className="max-w-md">
                <div className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
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
              </ExpandPanel>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-3 inline-flex items-center gap-3 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-1.5"
            >
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
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-4 inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] p-1"
            >
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
            </motion.div>

            {journeyMode === "surprise" ? (
              <motion.div
                key="surprise-settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex w-full flex-col items-center"
              >
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
              </motion.div>
            ) : (
              <motion.div
                key="custom-settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex w-full flex-col items-center"
              >
                <div className="mt-4 w-full max-w-md">{customKnobs}</div>
                <p className="mt-4 text-xs font-medium text-[color:var(--muted)]">
                  予算・時間・距離・移動手段に合う行き先だけを提案します
                </p>
              </motion.div>
            )}

            {recentJourneys.length > 0 && (
              <motion.div variants={fadeUp} className="mt-8 w-full max-w-md text-left">
                <p className="text-xs font-bold text-[color:var(--muted)]">
                  最近の行き先
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {recentJourneys.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => viewRecent(item)}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2.5 text-left transition hover:border-vermilion/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">
                          {item.destination.name}
                        </span>
                        <span className="block text-xs text-[color:var(--muted)]">
                          {item.prefecture.nameJa} ・ {item.distanceKm}km
                        </span>
                      </span>
                      <ChevronRight
                        size={16}
                        className="shrink-0 text-[color:var(--muted)]"
                      />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
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
          <div className="mt-12 grid items-center gap-10 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="relative mx-auto grid h-72 w-72 place-items-center"
            >
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
            </motion.div>

            <div className="text-center md:text-left">
              <div className="flex justify-center md:justify-start">
                <TabiMascot
                  mood={selecting ? "thinking" : "reveal"}
                  size="medium"
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
            <div className="mt-8 flex items-center gap-4 border-t border-[color:var(--line)] pt-6">
              <TabiMascot mood="reveal" size="medium" />
              <p className="text-sm font-medium leading-7">
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

            {journeyMode === "custom" && (
              <div className="mt-6 border-t border-[color:var(--line)] pt-6">
                <button
                  type="button"
                  onClick={() => setSettingsOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
                >
                  <SlidersHorizontal size={14} />
                  予算・距離・時間・移動手段を調整
                </button>
                <ExpandPanel open={settingsOpen}>
                  <div className="mt-3">{customKnobs}</div>
                </ExpandPanel>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ActionButton
                onClick={chooseDestination}
                icon={<Sparkles size={18} />}
                className="w-full sm:w-auto"
              >
                目的地を決める
              </ActionButton>
              <ActionButton
                variant="ghost"
                onClick={startShuffle}
                icon={<Shuffle size={17} />}
                className="w-full sm:w-auto"
              >
                4つの候補から選ぶ
              </ActionButton>
            </div>
            <button
              type="button"
              onClick={returnToStart}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
            >
              <House size={13} />
              メインに戻る
            </button>
          </div>
        </motion.section>
      )}

      {stage === "shuffle" && prefecture && (
        <motion.section
          key="shuffle"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-5 py-24 sm:px-6"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-vermilion">
                SHUFFLE / {prefecture.nameJa}
              </p>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">
                気になる場所をひとつ選ぼう
              </h2>
              <p className="mt-2 text-sm font-medium text-[color:var(--muted)]">
                タビが{prefecture.nameJa}から4つの候補を引いてきたよ。
              </p>
            </div>
            <TabiMascot mood="thinking" size="small" />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {shuffleOptions.map((plan, index) => {
              const distanceKm = haversineDistanceKm(start, plan.destination);
              const difficulty = journeyDifficulty(distanceKm);
              return (
                <motion.button
                  key={plan.destination.id}
                  type="button"
                  onClick={() => chooseShuffleOption(plan)}
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: index * 0.08, type: "spring", stiffness: 260, damping: 22 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`group overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] text-left shadow-float transition hover:border-vermilion/60 ${difficultyFrameClass(difficulty)}`}
                >
                  <div className="relative h-32 overflow-hidden bg-forest/10">
                    {plan.destination.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={plan.destination.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-forest/50 dark:text-[#8fd0b9]/50">
                        <MapPin size={32} />
                      </div>
                    )}
                    <DifficultyBadge
                      difficulty={difficulty}
                      className="absolute right-2 top-2 shadow-sm"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-black leading-snug">
                      {plan.destination.name}
                    </h3>
                    <p className="mt-1 text-xs font-bold text-[color:var(--muted)]">
                      {start.name}から約{distanceKm}km ・{" "}
                      {transportLabel(
                        plan.transport,
                        journeyMode === "custom" ? allowTransfer : false,
                      )}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {plan.destination.categories.slice(0, 2).map((category) => (
                        <span
                          key={category}
                          className="rounded-full bg-forest/10 px-2.5 py-1 text-[11px] font-bold text-forest dark:bg-[#8fd0b9]/10 dark:text-[#8fd0b9]"
                        >
                          {categoryLabels[category]}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-[color:var(--line)] pt-6 sm:flex-row">
            <p className="text-sm font-medium text-[color:var(--muted)]">
              ピンとこない？ 別の4つを引き直せるよ。
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ActionButton
                variant="ghost"
                onClick={reshuffle}
                icon={<Shuffle size={17} />}
              >
                引き直す
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

      {stage === "loading" && (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="fixed inset-x-0 top-24 z-10 flex justify-center">
            <TabiMascot mood="walking" size="small" />
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
          <div className="flex flex-wrap items-end justify-between gap-4">
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
              <DifficultyBadge
                difficulty={journeyDifficulty(
                  journey.distanceKm,
                  journey.estimatedTravelTime,
                )}
              />
              {isSeasonalMatch(journey.destination.categories) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sun/20 px-3 py-1.5 text-xs font-bold text-[#8a6a17] dark:text-sun">
                  {seasonInfo[CURRENT_SEASON].emoji}{" "}
                  {seasonInfo[CURRENT_SEASON].labelJa}のおすすめ
                </span>
              )}
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

          <motion.div
            variants={staggerParent}
            initial="hidden"
            animate="show"
            className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_.8fr]"
          >
            <motion.div variants={fadeUp} className="space-y-6">
              <ImageGallery
                images={
                  journey.destination.images?.length
                    ? journey.destination.images
                    : journey.destination.imageUrl
                      ? [journey.destination.imageUrl]
                      : []
                }
                alt={journey.destination.name}
                frameClass={difficultyFrameClass(
                  journeyDifficulty(
                    journey.distanceKm,
                    journey.estimatedTravelTime,
                  ),
                )}
              />

              <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-6">
                <h3 className="text-sm font-black">この場所について</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-[color:var(--foreground)]">
                  {journey.destination.description}
                </p>

                {aiEnabled && (
                  <div className="mt-4 border-t border-[color:var(--line)] pt-4">
                    <div className="flex flex-wrap gap-2">
                      {!aiText && (
                        <button
                          type="button"
                          onClick={handleAskAi}
                          disabled={aiLoading}
                          className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                        >
                          <Sparkles size={14} />
                          {aiLoading ? "タビが調べています…" : "タビにAIでもっと聞く"}
                        </button>
                      )}
                      {!aiPlan && (
                        <button
                          type="button"
                          onClick={handleAskPlan}
                          disabled={aiPlanLoading}
                          className="inline-flex items-center gap-2 rounded-full border border-forest px-4 py-2 text-xs font-bold text-forest transition hover:bg-forest/10 disabled:opacity-60 dark:border-[#8fd0b9] dark:text-[#8fd0b9]"
                        >
                          <Ticket size={14} />
                          {aiPlanLoading ? "プランを考え中…" : "1日プランを作ってもらう"}
                        </button>
                      )}
                    </div>
                    {aiText && (
                      <div className="mt-3 flex items-start gap-2">
                        <Sparkles
                          size={16}
                          className="mt-0.5 shrink-0 text-forest dark:text-[#8fd0b9]"
                        />
                        <div>
                          <p className="text-xs font-bold text-[color:var(--muted)]">
                            タビのAIガイド
                          </p>
                          <p className="mt-1 text-sm font-medium leading-7 text-[color:var(--foreground)]">
                            {aiText}
                          </p>
                          <p className="mt-2 text-[10px] text-[color:var(--muted)]">
                            AIによる生成のため、内容が不正確な場合があります。
                          </p>
                        </div>
                      </div>
                    )}
                    {aiPlan && (
                      <div className="mt-3 flex items-start gap-2">
                        <Ticket
                          size={16}
                          className="mt-0.5 shrink-0 text-forest dark:text-[#8fd0b9]"
                        />
                        <div>
                          <p className="text-xs font-bold text-[color:var(--muted)]">
                            タビの1日プラン
                          </p>
                          <p className="mt-1 whitespace-pre-line text-sm font-medium leading-7 text-[color:var(--foreground)]">
                            {aiPlan}
                          </p>
                          <p className="mt-2 text-[10px] text-[color:var(--muted)]">
                            AIによる生成のため、営業時間などは事前に確認してね。
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)]">
                <PlaceMap
                  key={journey.destination.id}
                  latitude={journey.destination.latitude}
                  longitude={journey.destination.longitude}
                  name={journey.destination.name}
                />
                <div className="flex items-center justify-between px-4 py-2 text-[10px] font-medium text-[color:var(--muted)]">
                  <span>周辺マップ</span>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${journey.destination.latitude}&mlon=${journey.destination.longitude}#map=14/${journey.destination.latitude}/${journey.destination.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    © OpenStreetMap contributors
                  </a>
                </div>
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
            </motion.div>

            <motion.div variants={fadeUp} className="space-y-4">
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
                <TabiMascot mood="excited" size="small" />
                <div className="pt-3">
                  <p className="text-xs font-bold text-[#bfe7d8]">
                    タビのおすすめ理由
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6">
                    {randomItem(reasonTexts)}
                  </p>
                </div>
              </div>

              {authEnabled &&
                (user ? (
                  <ActionButton
                    onClick={handleSaveCurrent}
                    icon={
                      savedJourneyId === journey.id ? (
                        <Check size={18} />
                      ) : (
                        <Bookmark size={18} />
                      )
                    }
                    className="w-full"
                  >
                    {savedJourneyId === journey.id
                      ? "保存しました"
                      : "この旅を保存"}
                  </ActionButton>
                ) : (
                  <ActionButton
                    onClick={() => signInWithGoogle().catch(() => {})}
                    icon={<Bookmark size={18} />}
                    className="w-full"
                  >
                    ログインして保存
                  </ActionButton>
                ))}

              <ActionButton
                variant="ghost"
                onClick={handleShare}
                icon={shareFeedback ? <Check size={18} /> : <Share2 size={18} />}
                className="w-full"
              >
                {shareFeedback ? "画像を保存＆コピーしました" : "この旅を共有"}
              </ActionButton>
            </motion.div>
          </motion.div>

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
