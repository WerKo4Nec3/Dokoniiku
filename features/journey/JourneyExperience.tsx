"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Bike,
  Bookmark,
  CalendarDays,
  Car,
  Check,
  Link2,
  Sunrise,
  Sunset,
  ChevronRight,
  Cloud,
  CloudRain,
  ExternalLink,
  Footprints,
  House,
  Images,
  Info,
  LocateFixed,
  MapPin,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  Route,
  Share2,
  Shuffle,
  Snowflake,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Tent,
  Ticket,
  TrainFront,
  Users,
  Utensils,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DEFAULT_START, prefectures } from "@/data/prefectures";
import { startPointPresets } from "@/data/startPoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  getAttractionsByPrefecture,
  getAttractionsNear,
  getPlaceThumbnails,
  type NearFilter,
} from "@/lib/api/places";
import {
  fetchRecentForUser,
  saveJourneyForUser,
  saveRecentForUser,
} from "@/lib/api/savedJourneys";
import { getWeatherByCoordinates } from "@/lib/api/weather";
import { readPreferences } from "@/lib/preferences";
import { encodeTrip } from "@/lib/tripShare";
import { getExcludedPlaceIds } from "@/lib/api/ratings";
import { trackSave, trackSearch } from "@/lib/analytics";
import { PlaceRating } from "@/components/PlaceRating";
import { AccessCard } from "@/components/AccessCard";
import { PlaceReviews } from "@/components/PlaceReviews";
import { GoHereButton } from "@/components/trip/GoHereButton";
import {
  getDestinationImages,
  getDestinationSummary,
  getNearbyPhotos,
  looksLikePhoto,
  mergePhotos,
  searchCommonsPhotos,
} from "@/lib/api/wikipedia";
import { getOpenversePhotos } from "@/lib/api/openverse";
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
  bearingOffset,
  bestTransport,
  bikeOneWayKm,
  categoryLabels,
  directionTowards,
  CURRENT_SEASON,
  estimateBudget,
  estimateTravelTime,
  formatMinutes,
  formatYen,
  googleMapsSearchUrl,
  haversineDistanceKm,
  isSeasonalMatch,
  journeyDifficulty,
  lodgingInfo,
  lodgingTypes,
  NEARBY_PREFECTURE_LIMIT_KM,
  pickDirection,
  pickPrefecture,
  randomItem,
  reachKm,
  seasonInfo,
  transportInfo,
  transportLabel,
} from "@/lib/utils/travel";
import type {
  Destination,
  DestinationCategory,
  Direction,
  JourneyResult,
  LodgingType,
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
import {
  CATEGORY_ORDER,
  CategoryCard,
} from "@/components/journey/CategoryCard";
import { TabiMascot } from "@/features/mascot/TabiMascot";
import { TabiSprite } from "@/features/mascot/TabiSprite";
import { SceneBackdrop, type ScenePhase } from "@/features/scene/SceneBackdrop";
import { nextScene, SCENES, sessionScene, type Scene } from "@/features/scene/scenes";
import { CompassRose } from "./CompassRose";
import { PrefectureMiniMap } from "./PrefectureMiniMap";
import { ImageGallery } from "./ImageGallery";
import {
  FactsCard,
  MenuCard,
  NearbyCard,
  VideosCard,
} from "./PlaceSections";
import { JourneySkeleton } from "./JourneySkeleton";

// Leaflet touches `window`, so load the interactive map client-side only.
const PlaceMap = dynamic(() => import("./PlaceMap"), {
  ssr: false,
  loading: () => (
    <div className="h-60 w-full animate-pulse bg-[color:var(--surface-muted)]" />
  ),
});
const RevealMap = dynamic(() => import("./RevealMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-[color:var(--surface-muted)]" />
  ),
});
const ShuffleMap = dynamic(() => import("./ShuffleMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-[color:var(--surface-muted)]" />
  ),
});

type Stage =
  | "landing"
  | "mode"
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

// Soft-bias the pick toward the traveller's favourite genres (~65% of the
// time when any match), while still keeping the seasonal nudge and room for
// discovery. Falls back to the season boost when there are no preferences.
function pickPlanWithBoost(pool: Plan[], preferred: DestinationCategory[]): Plan {
  if (preferred.length) {
    const liked = pool.filter((plan) =>
      plan.destination.categories.some((category) =>
        preferred.includes(category),
      ),
    );
    if (liked.length && Math.random() < 0.65) {
      return pickPlanWithSeasonBoost(liked);
    }
  }
  return pickPlanWithSeasonBoost(pool);
}

// Deal a hand of cards that leans toward favourite genres (~2/3) but keeps a
// couple of wildcards for discovery. Plain random when there are no favourites.
function sampleWithPreference(
  plans: Plan[],
  count: number,
  preferred: DestinationCategory[],
): Plan[] {
  if (!preferred.length) return sampleItems(plans, count);
  const liked = plans.filter((plan) =>
    plan.destination.categories.some((category) =>
      preferred.includes(category),
    ),
  );
  const likedIds = new Set(liked.map((plan) => plan.destination.id));
  const rest = plans.filter((plan) => !likedIds.has(plan.destination.id));
  const wantLiked = Math.min(liked.length, Math.ceil(count * 0.66));
  const pickedLiked = sampleItems(liked, wantLiked);
  const pickedRest = sampleItems(rest, count - pickedLiked.length);
  return sampleItems([...pickedLiked, ...pickedRest], count);
}

// Result page entrance: blocks stagger in.
const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

// Scene screens: copy drifts up out of a soft blur, one line at a time,
// once the painting has faded in.
const heroParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.45 } },
};
const heroItem = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
  },
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

// Fill percent (0..100) for a .range-brand slider's --fill.
function sliderFill(value: number, min: number, max: number): number {
  return Math.round(((value - min) / (max - min)) * 100);
}

const tripLengthIcons: Record<TripLengthId, LucideIcon> = {
  day: Sun,
  "one-night": Moon,
  "two-night": Tent,
};

// Card wrapper for one trip parameter (budget / distance / transport …).
function KnobCard({
  icon: Icon,
  title,
  value,
  children,
}: {
  icon: LucideIcon;
  title: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-[color:var(--foreground)]">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-vermilion/10 text-vermilion">
            <Icon size={16} />
          </span>
          {title}
        </span>
        {value != null && (
          <span className="rounded-full bg-[color:var(--surface-muted)] px-2.5 py-1 text-xs font-black tabular-nums text-[color:var(--foreground)]">
            {value}
          </span>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

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

const nightsFor = (id: TripLengthId) => (id === "day" ? 0 : id === "one-night" ? 1 : 2);

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
const BIKE_RANGE_MIN = 20;
const BIKE_RANGE_MAX = 300;
const SHUFFLE_COUNT = 4;
// Up to this one-way reach, the prefecture is chosen from the places actually
// within reach in the compass direction (beyond it, by its capital).
const SCOUT_MAX_REACH_KM = 150;
// Compass cones tried in turn until enough places fall inside one.
const SECTOR_STEPS = [22.5, 45, 67.5, 90, 180];
const MIN_SECTOR_PLACES = 5;

// Gemini-powered place insight is optional; the UI only appears when enabled.
const aiEnabled = process.env.NEXT_PUBLIC_GEMINI_ENABLED === "true";

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

// "2026-09-26" → "9/26（土）" for the forecast label.
const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];
function weatherDateLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const weekday = WEEKDAY_JA[new Date(y, m - 1, d).getDay()];
  return `${m}/${d}（${weekday}）`;
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
  const currentDirection = direction;
  const currentPrefecture = prefecture;
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
  // Painted scene behind landing → mode → compass → prefecture.
  const [scene, setScene] = useState<Scene | null>(null);
  const [spins, setSpins] = useState(0);

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
  // Cycling: the whole ride, there and back (split across days when staying).
  const [bikeRange, setBikeRange] = useState(60);
  const [lodging, setLodging] = useState<LodgingType>("business");
  // Places fetched for the current prefecture + genres, so changing the
  // settings can re-check them instantly instead of searching again.
  const [candidateCache, setCandidateCache] = useState<{
    key: string;
    candidates: Destination[];
    radiusKm: number;
  } | null>(null);
  // Short trips: the compass cone (degrees either side) the prefecture was
  // picked with, so destinations favour places in that direction too.
  const [sector, setSector] = useState<number | null>(null);
  const [scouting, setScouting] = useState(false);
  // Party-total budget cap grows with the headcount so large groups aren't
  // stuck under a fixed ¥100,000 ceiling that no plan can ever satisfy.
  const budgetMax = Math.max(BUDGET_MIN, BUDGET_PER_PERSON_MAX * people);
  const [savedJourneyId, setSavedJourneyId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
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
  const [shuffleHover, setShuffleHover] = useState<string | null>(null);
  const [revealTarget, setRevealTarget] = useState<{
    latitude: number;
    longitude: number;
    name: string;
    prefecture: string;
  } | null>(null);
  // Warm up the map chunks early so the reveal starts instantly.
  useEffect(() => {
    if (stage === "direction" || stage === "prefecture") {
      void import("./RevealMap");
      void import("./ShuffleMap");
    }
  }, [stage]);

  // Resolved by RevealMap when the fly-in lands (see finalizePlan).
  const revealLanded = useRef<(() => void) | null>(null);
  const shufflePoints = useMemo(
    () =>
      shuffleOptions.map((plan) => ({
        id: plan.destination.id,
        name: plan.destination.name,
        latitude: plan.destination.latitude,
        longitude: plan.destination.longitude,
      })),
    [shuffleOptions],
  );

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

  // The scene is picked on the client (random per session), then fades in.
  useEffect(() => {
    const timer = window.setTimeout(() => setScene(sessionScene()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const sceneOn =
    stage === "landing" || stage === "mode" || stage === "direction" || stage === "prefecture";
  const scenePhase: ScenePhase =
    stage === "landing" ? "hero" : stage === "mode" ? "menu" : "step";

  // Let the header melt into the scene, and tell CSS which ink it needs.
  useEffect(() => {
    const root = document.documentElement;
    if (sceneOn && scene) {
      root.dataset.scene = "on";
      root.dataset.sceneInk = scene.ink;
    } else {
      delete root.dataset.scene;
      delete root.dataset.sceneInk;
    }
    return () => {
      delete root.dataset.scene;
      delete root.dataset.sceneInk;
    };
  }, [sceneOn, scene]);

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

  // A quest-board spot hands a destination over via sessionStorage; run the
  // usual reveal → result flow for it.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = sessionStorage.getItem("dokoniiku:plan-destination");
        if (!raw) return;
        sessionStorage.removeItem("dokoniiku:plan-destination");
        const destination = JSON.parse(raw) as Destination;
        const target = prefectures.find((item) => item.id === destination?.prefectureId);
        if (!destination?.name || !target) return;
        const towards = directionTowards(start, destination);
        setDirection(towards);
        setPrefecture(target);
        void finalizePlan({ destination, transport: "train" }, false, undefined, {
          direction: towards,
          prefecture: target,
        });
      } catch {
        // corrupt hand-off — stay on the landing
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // Runs once on arrival; finalizePlan/start are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const nights = nightsFor(tripLength);
  const stay = { nights, lodging };
  const usableModes: TransportMode[] = transports.length ? transports : ["train"];
  const cycling = usableModes.includes("bicycle");
  const humanPoweredOnly = usableModes.every((mode) => mode === "bicycle" || mode === "walk");
  // A cyclist's own ride length is the limit; the generic distance cap
  // only applies when something motorised is in the mix.
  const distanceCap = cycling && humanPoweredOnly ? Infinity : maxDistance;
  // How far this trip can go one way with the chosen modes and days.
  const reach = reachKm({
    modes: usableModes,
    maxOneWayMinutes,
    maxDistanceKm: distanceCap,
    bikeRangeKm: cycling ? bikeRange : undefined,
  });
  // Custom searches only look within reach (with a little margin), so the
  // results are spent on places the trip can actually get to.
  const nearFilter: NearFilter | undefined =
    journeyMode === "custom" && reach <= 300
      ? { latitude: start.latitude, longitude: start.longitude, radiusKm: reach + 5 }
      : undefined;

  // Custom mode: which fetched places fit the budget, time/range and modes.
  function feasiblePlans(candidates: Destination[]): Plan[] {
    const plans: Plan[] = [];
    for (const candidate of candidates) {
      const distance = haversineDistanceKm(start, candidate);
      if (distance > distanceCap) continue;
      const best = bestTransport({
        distanceKm: distance,
        categories: candidate.categories,
        people,
        modes: usableModes,
        transfer: allowTransfer,
        maxBudget: budget,
        maxOneWayMinutes,
        bikeRangeKm: cycling ? bikeRange : undefined,
        stay,
      });
      if (best) plans.push({ destination: candidate, transport: best.mode });
    }
    return plans;
  }

  function beginDirectionSelection() {
    setSpins((count) => count + 1);
    setStage("direction");
    setDirection(null);
    setPrefecture(null);
    setJourney(null);
    setNotice(null);
    setFilterNotice(null);
    setSelecting(true);
    // Start looking around while the needle spins.
    if (journeyMode === "custom" && reach <= SCOUT_MAX_REACH_KM) void scoutAround();

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

  // Every place within reach in the prefectures around the start.
  function scoutAround(): Promise<Map<string, Destination[]>> {
    const around = prefectures
      .map((item) => ({ item, km: haversineDistanceKm(start, item) }))
      .filter(({ km }) => km <= reach + 120)
      .sort((a, b) => a.km - b.km)
      .slice(0, 10)
      .map(({ item }) => item);
    return getAttractionsNear(around, nearFilter!);
  }

  // Short trips: pick a prefecture by where the reachable places in the
  // compass direction actually are — widening the cone when that direction
  // is empty (out to sea, say). Bigger clusters are likelier picks.
  async function scoutPrefecture(
    towards: Direction,
    exclude?: string,
  ): Promise<{ prefecture: Prefecture; sector: number } | null> {
    const found = await scoutAround();
    const offsets: { id: string; offset: number }[] = [];
    for (const [id, places] of found) {
      if (id === exclude) continue;
      for (const plan of feasiblePlans(places)) {
        offsets.push({ id, offset: bearingOffset(start, plan.destination, towards) });
      }
    }
    for (const cone of SECTOR_STEPS) {
      const counts = new Map<string, number>();
      for (const item of offsets) {
        if (item.offset <= cone) counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
      }
      const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
      if (total < MIN_SECTOR_PLACES && cone < 180) continue;
      if (!total) return null;
      let ticket = Math.random() * total;
      for (const [id, count] of counts) {
        ticket -= count;
        if (ticket < 0) {
          const prefecture = prefectures.find((item) => item.id === id);
          return prefecture ? { prefecture, sector: cone } : null;
        }
      }
    }
    return null;
  }

  async function choosePrefecture(exclude?: string) {
    if (!direction || scouting) return;
    if (journeyMode === "custom" && reach <= SCOUT_MAX_REACH_KM) {
      setScouting(true);
      const scouted = await scoutPrefecture(direction, exclude).catch(() => null);
      setScouting(false);
      if (scouted) {
        setPrefecture(scouted.prefecture);
        setSector(scouted.sector);
        setFilterNotice(null);
        setStage("prefecture");
        return;
      }
      // Nothing found (or offline): fall back to picking by capital.
    }
    setSector(null);
    let pool: Prefecture[];
    if (journeyMode === "custom") {
      // Custom: only prefectures this trip can actually reach (their capital
      // within reach, with a little slack since places spread around it),
      // plus the one we start in.
      const slack = Math.min(30, Math.max(10, reach * 0.2));
      const home = prefectures.reduce((best, item) =>
        haversineDistanceKm(start, item) < haversineDistanceKm(start, best) ? item : best,
      );
      pool = prefectures.filter(
        (item) => item.id === home.id || haversineDistanceKm(start, item) <= reach + slack,
      );
      if (exclude && pool.length > 1) pool = pool.filter((item) => item.id !== exclude);
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

    const near = nearFilter;
    const places = await getAttractionsByPrefecture(prefecture, selectedCategories, near);
    // Drop places the community disliked (and ones you 👎'd yourself).
    const excluded = await getExcludedPlaceIds(user?.uid);
    const candidates = places.data.filter((place) => !excluded.has(place.id));

    setCandidateCache({
      key: `${prefecture.id}|${selectedCategories.join(",")}`,
      candidates,
      radiusKm: near?.radiusKm ?? Infinity,
    });

    if (!candidates.length) {
      const genre = selectedCategories.length ? "選んだジャンルの場所" : "候補";
      setFilterNotice(
        near
          ? `片道 約${reach}km以内の${prefecture.nameJa}には、${genre}が見つかりませんでした。${selectedCategories.length ? "ジャンルを変えるか、" : ""}行ける範囲の都道府県で探してみてね。`
          : "選んだジャンルに合う場所が見つかりませんでした。ジャンルを変えるか、メインに戻って別の方角を試してみてね。",
      );
      if (selectedCategories.length) setFiltersOpen(true);
      setStage("prefecture");
      return null;
    }

    let plans: Plan[];
    if (journeyMode === "custom") {
      plans = feasiblePlans(candidates);
      // Favour the compass direction when it still leaves a real choice —
      // not within a genre, whose few places shouldn't be thinned further.
      if (sector !== null && direction && !selectedCategories.length) {
        const ahead = plans.filter(
          (plan) => bearingOffset(start, plan.destination, direction) <= sector,
        );
        if (ahead.length >= 5) plans = ahead;
      }
      if (!plans.length) {
        // Say why: how far this trip reaches vs. the closest place here.
        const nearest = Math.min(...candidates.map((item) => haversineDistanceKm(start, item)));
        const lodgingNote = nights
          ? `（宿代の目安 ${formatYen(lodgingInfo[lodging].yenPerNight * nights * people)} も含めています）`
          : "";
        setFilterNotice(
          nearest > reach
            ? `この設定で行けるのは片道 約${reach}kmまで。${prefecture.nameJa}でいちばん近い候補は約${nearest}km先でした。行ける範囲の都道府県で探してみてね。`
            : `距離は届くけど、予算か移動時間が合いませんでした${lodgingNote}。下の設定をゆるめてみてね。`,
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
    // Explicit context for hand-offs (e.g. a quest spot) that start a trip
    // before the direction/prefecture state has caught up.
    context?: { direction: Direction; prefecture: Prefecture },
  ) {
    const direction = context?.direction ?? currentDirection;
    const prefecture = context?.prefecture ?? currentPrefecture;
    if (!direction || !prefecture) return;
    setStage("loading");
    setRevealTarget({
      latitude: plan.destination.latitude,
      longitude: plan.destination.longitude,
      name: plan.destination.name,
      prefecture: prefecture.nameJa,
    });
    const landed = new Promise<void>((resolve) => {
      revealLanded.current = resolve;
    });
    trackSearch(prefecture.id, plan.destination.categories);
    const startedAt = nowMs();
    const picked = plan.destination;
    const transport = plan.transport;
    const transfer = journeyMode === "custom" ? allowTransfer : false;

    const [weather, summary, gallery, commons, openverse] = await Promise.all([
      getWeatherByCoordinates(picked.latitude, picked.longitude),
      getDestinationSummary(picked.wikiTitle ?? picked.name),
      getDestinationImages(picked.wikiTitle ?? picked.name),
      searchCommonsPhotos(`${picked.name} ${prefecture.nameJa}`),
      getOpenversePhotos(`${picked.name} ${prefecture.nameJa}`),
    ]);
    // Lead with the article's hero image (unless it's a location/relief map,
    // common on small-place articles), then merge Wikimedia + Openverse photos.
    const candidateHero = summary?.imageUrl ?? picked.imageUrl;
    let images = mergePhotos(
      [
        candidateHero && looksLikePhoto(candidateHero) ? [candidateHero] : [],
        gallery,
        commons,
        openverse,
      ],
      12,
    );
    if (!images.length) {
      // No usable photo anywhere: fall back to photos near the coordinates.
      images = await getNearbyPhotos(picked.latitude, picked.longitude);
    }
    const heroImage = images[0];
    const destination = {
      ...picked,
      description: summary?.description ?? picked.description,
      imageUrl: heroImage,
      images,
    };
    const travel = estimateTravelTime(destination, start, transport, transfer);
    // Nights only come from the custom settings; surprise trips are day trips.
    const tripNights = nightsFor(tripLength);
    const tripStay =
      journeyMode === "custom" && tripNights ? { nights: tripNights, lodging } : undefined;
    const budgetResult = estimateBudget(
      travel.distanceKm,
      destination.categories,
      people,
      transport,
      transfer,
      tripStay,
    );
    // Hold the result until the Japan → place fly-in has landed (plus a beat
    // to see the pin + name), but never longer than ~7s in total.
    const pause = (ms: number) =>
      new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    await Promise.race([
      landed.then(() => pause(1100)),
      pause(Math.max(0, 7000 - (nowMs() - startedAt))),
    ]);
    revealLanded.current = null;

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
      ...(tripStay ? { nights: tripStay.nights, lodging: tripStay.lodging } : {}),
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

    // With an explicit genre filter, pick freely within it; otherwise bias
    // toward the traveller's saved favourites (and the season).
    const picked = selectedCategories.length
      ? randomItem(pool)
      : pickPlanWithBoost(pool, readPreferences());
    await finalizePlan(picked, built.providerMock, built.placesNotice);
  }

  // Shuffle mode: deal a hand of candidate cards and let the user pick one.
  async function startShuffle() {
    if (!direction || !prefecture) return;
    const built = await buildPlans();
    if (!built) return;
    setShufflePool(built);
    dealCards(sampleWithPreference(built.plans, SHUFFLE_COUNT, readPreferences()));
    setStage("shuffle");
  }

  // Show a hand of cards, then fill in photos (bulk searches come without).
  function dealCards(hand: Plan[]) {
    setShuffleOptions(hand);
    const bare = hand.filter((plan) => !plan.destination.imageUrl);
    if (!bare.length) return;
    void getPlaceThumbnails(bare.map((plan) => plan.destination)).then((thumbnails) => {
      if (!thumbnails.size) return;
      setShuffleOptions((current) =>
        current.map((plan) => {
          const imageUrl = thumbnails.get(plan.destination.id);
          return imageUrl && !plan.destination.imageUrl
            ? { ...plan, destination: { ...plan.destination, imageUrl } }
            : plan;
        }),
      );
    });
  }

  function reshuffle() {
    if (!shufflePool) return;
    const shown = new Set(shuffleOptions.map((plan) => plan.destination.id));
    const fresh = shufflePool.plans.filter((plan) => !shown.has(plan.destination.id));
    // Prefer unseen places; top up from the full pool when running low.
    const next = sampleItems(fresh, SHUFFLE_COUNT);
    if (next.length < SHUFFLE_COUNT) {
      const rest = shufflePool.plans.filter(
        (plan) => !next.some((p) => p.destination.id === plan.destination.id),
      );
      next.push(...sampleItems(rest, SHUFFLE_COUNT - next.length));
    }
    dealCards(next);
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
      trackSave();
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

  async function handleCopyLink() {
    if (!journey) return;
    const url = `${window.location.origin}/trip?d=${encodeTrip(journey)}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard blocked — nothing to do
    }
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
  // After a miss, re-check the places we already fetched as settings change.
  // Only trustworthy if the cached search covered the current reach.
  const liveMatches =
    journeyMode === "custom" &&
    prefecture &&
    candidateCache?.key === `${prefecture.id}|${selectedCategories.join(",")}` &&
    candidateCache.radiusKm >= (nearFilter?.radiusKm ?? Infinity)
      ? feasiblePlans(candidateCache.candidates).length
      : null;

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
            {selectedCategories.length}件
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

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CATEGORY_ORDER.map((category) => (
              <CategoryCard
                key={category}
                category={category}
                selected={selectedCategories.includes(category)}
                onClick={() => toggleCategory(category)}
              />
            ))}
          </div>
        </div>
      </ExpandPanel>
    </div>
  );

  // Budget / time / distance / transport knobs. Shared between the mode page
  // and the "loosen your settings" panel on the prefecture stage — where the
  // distance limits are gone (the prefecture is already chosen).
  const bikeOnly = cycling && humanPoweredOnly;
  const bikeHalf = bikeOneWayKm(bikeRange);
  const rideTime = (km: number) =>
    formatMinutes(Math.round((km / transportInfo.bicycle.speedKmh) * 60));
  const lodgingTotal = lodgingInfo[lodging].yenPerNight * nights * people;
  const renderKnobs = (atPrefecture: boolean) => (
    <div className="space-y-3 text-left">
      <KnobCard icon={TrainFront} title="移動手段（複数選択可）">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {allTransportModes.map((mode) => {
            const Icon = transportIcons[mode];
            const active = transports.includes(mode);
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTransport(mode)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-[11px] font-bold transition ${
                  active
                    ? "border-vermilion bg-vermilion/10 text-vermilion"
                    : "border-[color:var(--line)] bg-[color:var(--surface-muted)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                }`}
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full transition ${
                    active
                      ? "bg-vermilion text-white"
                      : "bg-[color:var(--surface)] text-[color:var(--foreground)]"
                  }`}
                >
                  <Icon size={17} />
                </span>
                {transportInfo[mode].labelJa}
              </button>
            );
          })}
        </div>
      </KnobCard>

      {cycling && !atPrefecture && (
        <KnobCard icon={Bike} title="自転車で走る距離（往復の合計）" value={`${bikeRange}km`}>
          <input
            type="range"
            min={BIKE_RANGE_MIN}
            max={BIKE_RANGE_MAX}
            step={5}
            value={bikeRange}
            onChange={(event) => setBikeRange(Number(event.target.value))}
            className="range-brand"
            style={
              {
                "--fill": `${sliderFill(bikeRange, BIKE_RANGE_MIN, BIKE_RANGE_MAX)}%`,
              } as React.CSSProperties
            }
          />
          <div className="mt-1 flex justify-between text-[10px] font-bold text-[color:var(--muted)]">
            <span>{BIKE_RANGE_MIN}km</span>
            <span>{BIKE_RANGE_MAX}km</span>
          </div>
          <p className="mt-1.5 text-[11px] font-medium leading-5 text-[color:var(--muted)]">
            {nights === 0
              ? `行き${bikeHalf}km・帰り${bikeHalf}kmをその日のうちに（走るのは${rideTime(bikeRange)}）。`
              : nights === 1
                ? `1日目に${bikeHalf}km走って泊まり、2日目に${bikeHalf}km帰る（1日${rideTime(bikeHalf)}）。`
                : `1日目に${bikeHalf}km、2日目は現地でのんびり、3日目に${bikeHalf}km帰る（1日${rideTime(bikeHalf)}）。`}
          </p>
        </KnobCard>
      )}

      {!atPrefecture && !bikeOnly && (
        <KnobCard
          icon={Route}
          title="出発地からの距離（上限）"
          value={`約${maxDistance}km`}
        >
          <input
            type="range"
            min={5}
            max={DISTANCE_MAX}
            step={5}
            value={maxDistance}
            onChange={(event) => setMaxDistance(Number(event.target.value))}
            className="range-brand"
            style={
              {
                "--fill": `${sliderFill(maxDistance, 5, DISTANCE_MAX)}%`,
              } as React.CSSProperties
            }
          />
          <div className="mt-1 flex justify-between text-[10px] font-bold text-[color:var(--muted)]">
            <span>5km</span>
            <span>{DISTANCE_MAX}km</span>
          </div>
        </KnobCard>
      )}

      <KnobCard
        icon={WalletCards}
        title={`予算（${people}名・上限）`}
        value={formatYen(budget)}
      >
        <input
          type="range"
          min={BUDGET_MIN}
          max={budgetMax}
          step={1000}
          value={budget}
          onChange={(event) => setBudget(Number(event.target.value))}
          className="range-brand"
          style={
            {
              "--fill": `${sliderFill(budget, BUDGET_MIN, budgetMax)}%`,
            } as React.CSSProperties
          }
        />
        <div className="mt-1 flex justify-between text-[10px] font-bold text-[color:var(--muted)]">
          <span>{formatYen(BUDGET_MIN)}</span>
          <span>{formatYen(budgetMax)}</span>
        </div>
        {(bikeOnly || nights > 0) && (
          <p className="mt-1.5 text-[11px] font-medium leading-5 text-[color:var(--muted)]">
            {bikeOnly &&
              `自転車なので交通費は0円。食事・入場料${nights ? "・宿代" : ""}に使う予算です。`}
            {nights > 0 &&
              `宿代の目安 ${formatYen(lodgingTotal)}（${lodgingInfo[lodging].labelJa}・${nights}泊）も含めて計算します。`}
          </p>
        )}
      </KnobCard>

      <KnobCard icon={CalendarDays} title="旅の日数">
        <div className="grid grid-cols-3 gap-2">
          {tripLengthOptions.map((option) => {
            const Icon = tripLengthIcons[option.id];
            const active = tripLength === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTripLength(option.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-bold transition ${
                  active
                    ? "border-vermilion bg-vermilion/10 text-vermilion"
                    : "border-[color:var(--line)] bg-[color:var(--surface-muted)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                }`}
              >
                <Icon size={18} />
                {option.labelJa}
                <span className="text-[10px] font-medium opacity-70">
                  {bikeOnly
                    ? option.id === "day"
                      ? `1日${bikeRange}km`
                      : `1日${bikeHalf}km${option.id === "two-night" ? "＋中日" : ""}`
                    : `片道〜${Math.round(option.maxOneWayMinutes / 60)}h`}
                </span>
              </button>
            );
          })}
        </div>
      </KnobCard>

      {nights > 0 && (
        <KnobCard icon={BedDouble} title="泊まる宿（1名1泊の目安）">
          <div className="grid grid-cols-3 gap-2">
            {lodgingTypes.map((type) => {
              const active = lodging === type;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setLodging(type)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2.5 text-[11px] font-bold transition ${
                    active
                      ? "border-vermilion bg-vermilion/10 text-vermilion"
                      : "border-[color:var(--line)] bg-[color:var(--surface-muted)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                  }`}
                >
                  {lodgingInfo[type].labelJa}
                  <span className="text-[10px] font-medium opacity-70">
                    {formatYen(lodgingInfo[type].yenPerNight)}〜
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] font-medium text-[color:var(--muted)]">
            実際の料金は宿や時期で変わります。
          </p>
        </KnobCard>
      )}

      {usableModes.some((mode) => mode === "train" || mode === "shinkansen") && (
        <KnobCard icon={Ticket} title="乗り継ぎ（タクシー等）">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-[color:var(--muted)]">
              鉄道の旅にラストワンマイルのタクシーを許可します
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={allowTransfer}
              aria-label="乗り継ぎを許可"
              onClick={() => setAllowTransfer((value) => !value)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                allowTransfer ? "bg-vermilion" : "bg-[color:var(--line)]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  allowTransfer ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </KnobCard>
      )}
    </div>
  );

  return (
    <>
    <AnimatePresence>
      {sceneOn && scene && (
        <SceneBackdrop key="scene" scene={scene} phase={scenePhase} />
      )}
    </AnimatePresence>
    <AnimatePresence mode="wait">
      {stage === "landing" && (
        <motion.section
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          className="relative z-10 flex min-h-[100svh] flex-col px-6 pb-10 pt-28 sm:px-10 md:justify-center md:pt-16 lg:px-20"
        >
          <motion.div
            variants={heroParent}
            initial="hidden"
            animate="show"
            className="scene-copy mx-auto w-full max-w-6xl"
          >
            <div className="max-w-xl">
              <motion.h1
                variants={heroItem}
                className="font-display text-[clamp(2.3rem,6.2vw,4.4rem)] font-normal leading-[1.42] tracking-[0.14em] text-[color:var(--foreground)]"
              >
                次の休日、
                <br />
                どこに行く？
              </motion.h1>
              <motion.p
                variants={heroItem}
                className="mt-4 text-sm font-bold tracking-[0.24em] text-[color:var(--muted)] sm:text-base"
              >
                まだ見ぬ日本に、出会おう。
              </motion.p>
              <motion.div variants={heroItem} className="mt-10">
                <motion.button
                  type="button"
                  onClick={() => setStage("mode")}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="scene-cta group"
                >
                  旅先を決める
                  <ArrowRight size={18} className="transition group-hover:translate-x-1" />
                </motion.button>
              </motion.div>
              <motion.div
                variants={heroItem}
                className="scene-glass mt-12 inline-flex items-center gap-3 rounded-full py-1.5 pl-5 pr-1.5"
              >
                <span className="mr-1 text-xs font-bold tracking-[0.22em] text-[color:var(--muted)]">
                  人数
                </span>
                <button
                  type="button"
                  onClick={() => setPeople((n) => Math.max(1, n - 1))}
                  disabled={people <= 1}
                  aria-label="人数を減らす"
                  className="scene-round"
                >
                  <Minus size={16} />
                </button>
                <span className="relative grid w-8 place-items-center overflow-hidden text-2xl font-medium tabular-nums text-[color:var(--foreground)]">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={people}
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -10, opacity: 0 }}
                    >
                      {people}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <button
                  type="button"
                  onClick={() => setPeople((n) => Math.min(20, n + 1))}
                  disabled={people >= 20}
                  aria-label="人数を増やす"
                  className="scene-round"
                >
                  <Plus size={16} />
                </button>
              </motion.div>
            </div>
          </motion.div>

          {scene && SCENES.length > 1 && (
            <motion.button
              type="button"
              onClick={() => setScene((current) => (current ? nextScene(current) : current))}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 1.6 } }}
              className="scene-glass absolute bottom-6 right-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-[color:var(--foreground)]"
            >
              <Images size={14} />
              {scene.nameJa}
            </motion.button>
          )}
        </motion.section>
      )}

      {stage === "mode" && (
        <motion.section
          key="mode"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col justify-center px-5 pb-12 pt-24 sm:px-8"
        >
          <motion.div variants={heroParent} initial="hidden" animate="show">
            <motion.button
              type="button"
              variants={heroItem}
              onClick={() => setStage("landing")}
              className="scene-copy inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.18em] text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
            >
              <ArrowLeft size={14} />
              もどる
            </motion.button>
            <motion.h2
              variants={heroItem}
              className="scene-copy mt-4 font-display text-[clamp(1.8rem,4vw,2.75rem)] font-normal tracking-[0.14em] text-[color:var(--foreground)]"
            >
              どうやって決める？
            </motion.h2>
            <motion.div variants={heroItem} className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStartPickerOpen((open) => !open)}
                className="scene-glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-[color:var(--foreground)]"
              >
                <MapPin size={13} className="text-vermilion" />
                出発: {start.name}
                <ChevronRight
                  size={13}
                  className={`text-[color:var(--muted)] transition ${startPickerOpen ? "rotate-90" : ""}`}
                />
              </button>
              <span className="scene-glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-[color:var(--foreground)]">
                <Users size={13} className="text-vermilion" />
                {people}名
              </span>
            </motion.div>

            <ExpandPanel open={startPickerOpen} className="max-w-md">
              <div className="scene-glass mt-3 w-full rounded-2xl p-4">
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={locating}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest/10 px-4 py-2.5 text-sm font-bold text-forest transition hover:bg-forest/15 disabled:opacity-60 dark:bg-forest-ink/10 dark:text-forest-ink"
                >
                  <LocateFixed size={16} />
                  {locating ? "現在地を取得中…" : "現在地を使う"}
                </button>
                {locationError && (
                  <p className="mt-2 text-xs font-medium text-[color:var(--brand-ink)]">
                    {locationError}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
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

            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <motion.div variants={heroItem} className="scene-glass relative overflow-hidden rounded-[28px] p-6 sm:p-7">
                <TabiSprite
                  pose="camera"
                  className="pointer-events-none absolute -right-4 -top-2 aspect-[538/422] w-32 sm:w-36"
                />
                <p className="text-[11px] font-bold tracking-[0.3em] text-vermilion">OMAKASE</p>
                <h3 className="mt-2 font-display text-2xl font-bold tracking-[0.08em] text-[color:var(--foreground)]">
                  タビにおまかせ
                </h3>
                <p className="mt-2 max-w-[15rem] text-sm leading-6 text-[color:var(--muted)]">
                  方角も、行き先も。ぜんぶタビが決めるよ。
                </p>
                <div className="mt-5 inline-flex rounded-full bg-[color:var(--surface-muted)] p-1 text-xs font-bold">
                  {(
                    [
                      ["nearby", "近場", "日帰り圏"],
                      ["all", "全国", "47都道府県"],
                    ] as const
                  ).map(([id, label, sub]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={scope === id}
                      onClick={() => setScope(id)}
                      className={`relative rounded-full px-4 py-2 transition ${
                        scope === id
                          ? "text-[color:var(--foreground)]"
                          : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                      }`}
                    >
                      {scope === id && (
                        <motion.span
                          layoutId="scope-pill"
                          className="absolute inset-0 rounded-full bg-[color:var(--surface)] shadow-sm"
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        />
                      )}
                      <span className="relative">
                        {label}
                        <span className="ml-1 font-medium opacity-70">{sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setJourneyMode("surprise");
                      beginDirectionSelection();
                    }}
                    className="scene-cta group"
                  >
                    このまま出発
                    <ArrowRight size={17} className="transition group-hover:translate-x-1" />
                  </button>
                </div>
              </motion.div>

              <motion.div
                variants={heroItem}
                className={`scene-glass relative overflow-hidden rounded-[28px] p-6 transition sm:p-7 ${
                  journeyMode === "custom" ? "ring-2 ring-vermilion/60" : ""
                }`}
              >
                <TabiSprite
                  pose="map"
                  className="pointer-events-none absolute -right-4 -top-2 aspect-[538/422] w-32 sm:w-36"
                />
                <p className="text-[11px] font-bold tracking-[0.3em] text-vermilion">KODAWARI</p>
                <h3 className="mt-2 font-display text-2xl font-bold tracking-[0.08em] text-[color:var(--foreground)]">
                  こだわって探す
                </h3>
                <p className="mt-2 max-w-[15rem] text-sm leading-6 text-[color:var(--muted)]">
                  予算・日数・距離・移動手段から、条件に合う場所だけ。
                </p>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() =>
                      setJourneyMode((mode) => (mode === "custom" ? "surprise" : "custom"))
                    }
                    aria-expanded={journeyMode === "custom"}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-6 py-3.5 text-sm font-bold tracking-[0.12em] text-[color:var(--foreground)] transition hover:border-vermilion/60"
                  >
                    <SlidersHorizontal size={16} className="text-vermilion" />
                    {journeyMode === "custom" ? "条件を閉じる" : "条件を決める"}
                  </button>
                </div>
              </motion.div>
            </div>

            <ExpandPanel open={journeyMode === "custom"}>
              <div className="scene-glass mt-4 rounded-[28px] p-4 sm:p-6">
                {renderKnobs(false)}
                <p className="mt-3 text-center text-xs font-bold text-[color:var(--muted)]">
                  この設定で行ける範囲：片道 約{reach}km
                </p>
                <div className="mt-5 flex justify-end">
                  <button type="button" onClick={beginDirectionSelection} className="scene-cta group">
                    この条件で出発
                    <ArrowRight size={17} className="transition group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            </ExpandPanel>

            {recentJourneys.length > 0 && (
              <motion.div variants={heroItem} className="mt-7">
                <p className="scene-copy text-[11px] font-bold tracking-[0.22em] text-[color:var(--muted)]">
                  最近の行き先
                </p>
                <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
                  {recentJourneys.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => viewRecent(item)}
                      className="scene-glass inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-[color:var(--foreground)] transition hover:-translate-y-0.5"
                    >
                      {item.destination.name}
                      <span className="font-medium text-[color:var(--muted)]">
                        {item.prefecture.nameJa}
                      </span>
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
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col justify-center px-5 pb-12 pt-24 sm:px-8"
        >
          <div className="scene-glass grid items-center gap-8 rounded-[32px] p-6 sm:p-10 md:grid-cols-[1.05fr_1fr]">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 150, damping: 18 }}
              className="mx-auto w-full max-w-[22rem]"
            >
              <CompassRose direction={direction} spinning={selecting} spins={spins} />
            </motion.div>

            <div className="text-center md:text-left">
              <div className="flex justify-center md:justify-start">
                <TabiMascot mood={selecting ? "thinking" : "reveal"} size="small" />
              </div>
              <p className="mt-4 text-[11px] font-bold tracking-[0.3em] text-vermilion">
                STEP 01 ・ 方角
              </p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.h2
                  key={selecting ? "spin" : direction ?? ""}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-3 font-display text-3xl font-bold tracking-[0.08em] sm:text-4xl"
                >
                  {selecting ? "タビが風を読んでいます…" : `今日は「${direction}」へ！`}
                </motion.h2>
              </AnimatePresence>
              <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">
                {selecting
                  ? "どの方角になるかは、タビだけが知っています。"
                  : "この先にある都道府県から、次の行き先を選びます。"}
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center md:justify-start">
                <button
                  type="button"
                  onClick={() => choosePrefecture()}
                  disabled={selecting || scouting || !direction}
                  className="scene-cta group justify-center"
                >
                  {scouting ? "行ける場所を探しています…" : "この方角へ進む"}
                  <ArrowRight size={17} className="transition group-hover:translate-x-1" />
                </button>
                <button
                  type="button"
                  onClick={beginDirectionSelection}
                  disabled={selecting}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-6 py-3.5 text-sm font-bold text-[color:var(--foreground)] transition hover:border-vermilion/60 disabled:opacity-50"
                >
                  <motion.span
                    className="inline-flex"
                    animate={selecting ? { rotate: -360 } : { rotate: 0 }}
                    transition={{ duration: 1, repeat: selecting ? Infinity : 0, ease: "linear" }}
                  >
                    <RotateCcw size={16} />
                  </motion.span>
                  {selecting ? "回しています…" : "もう一度回す"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setStage("mode")}
                className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
              >
                <ArrowLeft size={13} />
                選び方に戻る
              </button>
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
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col justify-center px-5 pb-12 pt-24 sm:px-8"
        >
          <div className="scene-glass overflow-hidden rounded-[32px]">
            <div className="grid md:grid-cols-[0.9fr_1.1fr]">
              <div className="relative aspect-[4/3] border-b border-[color:var(--line)] bg-[color:color-mix(in_srgb,var(--surface-muted)_55%,transparent)] md:aspect-auto md:min-h-[28rem] md:border-b-0 md:border-r">
                <PrefectureMiniMap id={prefecture.id} accent={prefecture.accent} />
                <span
                  className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: prefecture.accent }}
                >
                  {prefecture.region}
                </span>
              </div>

              <div className="p-6 sm:p-10">
                <p className="text-[11px] font-bold tracking-[0.3em] text-vermilion">
                  STEP 02 ・ 都道府県
                </p>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.6 }}
                  className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1"
                >
                  <h2 className="font-display text-5xl font-bold tracking-[0.1em] sm:text-6xl">
                    {prefecture.nameJa}
                  </h2>
                  <p className="pb-2 text-xs font-bold tracking-[0.24em] text-[color:var(--muted)]">
                    {prefecture.nameEn.toUpperCase()}
                  </p>
                </motion.div>
                <p className="mt-5 max-w-md text-sm font-medium leading-8 text-[color:var(--muted)]">
                  {prefecture.shortDescriptionJa}
                </p>
                <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[color:var(--surface-muted)] p-3 pr-4">
                  <TabiSprite pose="pointing" shadow={false} effects={false} className="aspect-[538/422] w-16 shrink-0" />
                  <p className="text-sm font-medium leading-6">
                    「{direction}」の風が、ここまで連れてきたよ。次は本当の目的地を探そう。
                  </p>
                </div>

                {filterPanel}

                {filterNotice && liveMatches !== null && liveMatches > 0 ? (
                  <div className="mt-5 flex items-start gap-2 rounded-2xl border border-forest/40 bg-forest/10 px-4 py-3 text-xs font-bold leading-5 text-forest dark:text-forest-ink">
                    <Check size={16} className="mt-0.5 shrink-0" />
                    <span>いまの設定なら{liveMatches}か所見つかるよ！「目的地を決める」をどうぞ。</span>
                  </div>
                ) : (
                  filterNotice && (
                    <div className="mt-5 rounded-2xl border border-vermilion/40 bg-vermilion/10 px-4 py-3 text-xs font-medium leading-5">
                      <p className="flex items-start gap-2">
                        <Info size={16} className="mt-0.5 shrink-0 text-vermilion" />
                        <span>{filterNotice}</span>
                      </p>
                      {journeyMode === "custom" && (
                        <button
                          type="button"
                          onClick={() => choosePrefecture(prefecture.id)}
                          disabled={scouting}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-vermilion px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                        >
                          <Route size={14} />
                          {scouting ? "探しています…" : "行ける範囲の都道府県で探す"}
                        </button>
                      )}
                    </div>
                  )
                )}

                {journeyMode === "custom" && (
                  <div className="mt-6 border-t border-[color:var(--line)] pt-6">
                    <button
                      type="button"
                      onClick={() => setSettingsOpen((open) => !open)}
                      className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-2 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
                    >
                      <SlidersHorizontal size={14} />
                      予算・日数・移動手段を調整
                    </button>
                    <ExpandPanel open={settingsOpen}>
                      <div className="mt-3">{renderKnobs(true)}</div>
                    </ExpandPanel>
                  </div>
                )}

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button type="button" onClick={chooseDestination} className="scene-cta group justify-center">
                    <Sparkles size={17} />
                    目的地を決める
                  </button>
                  <button
                    type="button"
                    onClick={startShuffle}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-6 py-3.5 text-sm font-bold text-[color:var(--foreground)] transition hover:border-vermilion/60"
                  >
                    <Shuffle size={16} />
                    4つの候補から選ぶ
                  </button>
                </div>
                <button
                  type="button"
                  onClick={returnToStart}
                  className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
                >
                  <House size={13} />
                  メインに戻る
                </button>
              </div>
            </div>
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

          <div className="mt-6 h-64 overflow-hidden rounded-2xl border border-[color:var(--line)] shadow-float sm:h-80">
            <ShuffleMap
              points={shufflePoints}
              activeId={shuffleHover}
              onHover={setShuffleHover}
              onPick={(id) => {
                const plan = shuffleOptions.find((p) => p.destination.id === id);
                if (plan) chooseShuffleOption(plan);
              }}
            />
          </div>
          <p className="mt-2 text-center text-xs font-bold text-[color:var(--muted)]">
            地図のピンをタップしても選べるよ
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {shuffleOptions.map((plan, index) => {
              const distanceKm = haversineDistanceKm(start, plan.destination);
              const difficulty = journeyDifficulty(distanceKm);
              return (
                <motion.button
                  key={plan.destination.id}
                  type="button"
                  onClick={() => chooseShuffleOption(plan)}
                  onMouseEnter={() => setShuffleHover(plan.destination.id)}
                  onMouseLeave={() => setShuffleHover(null)}
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
                      <div className="grid h-full w-full place-items-center text-forest-ink/50 dark:text-forest-ink/50">
                        <MapPin size={32} />
                      </div>
                    )}
                    <DifficultyBadge
                      difficulty={difficulty}
                      className="absolute right-2 top-2 shadow-sm"
                    />
                    <span
                      className={`absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-vermilion text-sm font-black text-white shadow transition ${
                        shuffleHover === plan.destination.id ? "scale-110" : ""
                      }`}
                    >
                      {index + 1}
                    </span>
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
                          className="rounded-full bg-forest/10 px-2.5 py-1 text-[11px] font-bold text-forest dark:bg-forest-ink/10 dark:text-forest-ink"
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
          {revealTarget ? (
            <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 pb-10 pt-24 sm:px-6">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-vermilion">
                    TABI&apos;S PICK / {revealTarget.prefecture}
                  </p>
                  <motion.h2
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2.6 }}
                    className="mt-1 truncate font-display text-3xl font-black sm:text-4xl"
                  >
                    {revealTarget.name}
                  </motion.h2>
                </div>
                <TabiMascot mood="walking" size="small" />
              </div>
              <div className="mt-4 h-[56vh] min-h-72 w-full overflow-hidden rounded-2xl border border-[color:var(--line)] shadow-float">
                <RevealMap
                  latitude={revealTarget.latitude}
                  longitude={revealTarget.longitude}
                  name={revealTarget.name}
                  onLanded={() => revealLanded.current?.()}
                />
              </div>
              <p className="mt-3 text-center text-sm font-bold text-[color:var(--muted)]">
                タビが目的地へ案内中… 天気と写真も集めています
              </p>
            </section>
          ) : (
            <>
              <div className="fixed inset-x-0 top-24 z-10 flex justify-center">
                <TabiMascot mood="walking" size="small" />
              </div>
              <JourneySkeleton />
            </>
          )}
        </motion.div>
      )}

      {stage === "result" && journey && (
        <motion.section
          key="result"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-4 py-24 sm:px-6"
        >
          <div className="relative overflow-clip rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-float sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-vermilion/10 blur-3xl"
            />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[0.3em] text-vermilion">
                  TABI&apos;S PICK ・ 週末の行き先
                </p>
                <h2 className="mt-3 font-display text-4xl font-bold leading-tight tracking-[0.05em] sm:text-5xl">
                  {journey.destination.name}
                </h2>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-[color:var(--muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={15} />
                    {journey.prefecture.nameJa} ・ {journey.distanceKm}km
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <TransportIcon mode={journey.transport} size={15} />
                    片道{formatMinutes(journey.estimatedTravelTime)}
                  </span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <DifficultyBadge
                    difficulty={journeyDifficulty(
                      journey.distanceKm,
                      journey.estimatedTravelTime,
                    )}
                  />
                  {isSeasonalMatch(journey.destination.categories) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sun/20 px-3 py-1.5 text-xs font-bold text-[#816106] dark:text-sun">
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
                      className="rounded-full bg-forest/10 px-3 py-1.5 text-xs font-bold text-forest dark:bg-forest-ink/10 dark:text-forest-ink"
                    >
                      {categoryLabels[category]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="shrink-0">
                <GoHereButton
                  journey={journey}
                  onStarted={() => {
                    if (user) setSavedJourneyId(journey.id);
                  }}
                />
              </div>
            </div>
          </div>

          {notice && (
            <div className="mt-5 flex items-start gap-2 rounded-2xl border border-sun/40 bg-sun/10 px-4 py-3 text-xs font-medium leading-5">
              <Info size={16} className="mt-0.5 shrink-0 text-[#9b7418]" />
              <span>{notice}</span>
            </div>
          )}

          <motion.div
            variants={staggerParent}
            initial="hidden"
            animate="show"
            className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_.8fr]"
          >
            {/* On mobile every block is flattened into one column and reordered
                via `order-*` (weather/budget up, videos/map down); on desktop
                the two columns return via `lg:block`. */}
            <div className="contents lg:block lg:min-w-0 lg:space-y-6">
              <ImageGallery
                className="order-1 lg:order-none"
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
              <p className="order-1 px-1 text-[10px] leading-4 text-[color:var(--muted)] lg:order-none">
                写真:{" "}
                <a
                  href="https://commons.wikimedia.org"
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  Wikimedia Commons
                </a>
                {" ・ "}
                <a
                  href="https://openverse.org"
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  Openverse
                </a>
                （各画像の著作権は投稿者に帰属します）
              </p>

              <div className="order-2 rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 lg:order-none">
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
                          className="inline-flex items-center gap-2 rounded-full border border-forest px-4 py-2 text-xs font-bold text-forest transition hover:bg-forest/10 disabled:opacity-60 dark:border-forest-ink dark:text-forest-ink"
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
                          className="mt-0.5 shrink-0 text-forest dark:text-forest-ink"
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
                          className="mt-0.5 shrink-0 text-forest dark:text-forest-ink"
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

              {journey.destination.categories.includes("food") && (
                <MenuCard
                  key={`menu-${journey.destination.id}`}
                  className="order-2 lg:order-none"
                  name={journey.destination.name}
                  prefecture={journey.prefecture.nameJa}
                  latitude={journey.destination.latitude}
                  longitude={journey.destination.longitude}
                  aiEnabled={aiEnabled}
                />
              )}

              <FactsCard
                key={`facts-${journey.destination.id}`}
                className="order-9 lg:order-none"
                name={journey.destination.name}
                prefecture={journey.prefecture.nameJa}
                categories={journey.destination.categories}
                aiEnabled={aiEnabled}
              />

              <VideosCard
                key={`videos-${journey.destination.id}`}
                className="order-11 lg:order-none"
                name={journey.destination.name}
                prefecture={journey.prefecture.nameJa}
              />

              <NearbyCard
                key={`nearby-${journey.destination.id}`}
                className="order-10 lg:order-none"
                placeName={journey.destination.name}
                latitude={journey.destination.latitude}
                longitude={journey.destination.longitude}
              />

              <div className="order-12 min-w-0 overflow-hidden rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] lg:order-none">
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

              <div className="order-12 flex flex-col gap-4 rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between lg:order-none">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest/10 text-forest dark:bg-forest-ink/10 dark:text-forest-ink">
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
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 text-sm font-bold transition hover:bg-[color:var(--surface-muted)]"
                >
                  Google Mapsで見る
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>

            <div className="contents lg:block lg:min-w-0 lg:space-y-4">
              <div className="order-3 rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 lg:order-none">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[color:var(--muted)]">
                      {journey.weather.forDate
                        ? `${weatherDateLabel(journey.weather.forDate)}の予報`
                        : "現地の天気"}
                    </p>
                    <p className="mt-2 text-3xl font-black">
                      {journey.weather.temperature}℃
                    </p>
                    <p className="mt-1 text-sm font-bold">
                      {journey.weather.description}
                    </p>
                    {(journey.weather.high != null ||
                      journey.weather.precipitation != null) && (
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-bold text-[color:var(--muted)]">
                        {journey.weather.high != null &&
                          journey.weather.low != null && (
                            <span>
                              最高 {journey.weather.high}° / 最低{" "}
                              {journey.weather.low}°
                            </span>
                          )}
                        {journey.weather.precipitation != null && (
                          <span className="inline-flex items-center gap-1">
                            <CloudRain size={13} className="text-sky" />
                            {journey.weather.precipitation}%
                          </span>
                        )}
                      </p>
                    )}
                    {(journey.weather.sunrise || journey.weather.sunset) && (
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-bold text-[color:var(--muted)]">
                        {journey.weather.sunrise && (
                          <span className="inline-flex items-center gap-1">
                            <Sunrise size={13} className="text-sun" />
                            日の出 {journey.weather.sunrise}
                          </span>
                        )}
                        {journey.weather.sunset && (
                          <span className="inline-flex items-center gap-1">
                            <Sunset size={13} className="text-vermilion" />
                            日の入り {journey.weather.sunset}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <WeatherIcon weather={journey.weather} />
                </div>
                <p className="mt-4 border-t border-[color:var(--line)] pt-4 text-xs font-medium leading-6 text-[color:var(--muted)]">
                  {journey.weather.advice}
                </p>
              </div>

              <div className="order-4 grid grid-cols-2 gap-4 lg:order-none">
                <div className="rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
                  <TransportIcon
                    mode={journey.transport}
                    className="text-forest dark:text-forest-ink"
                  />
                  <p className="mt-4 text-xs font-bold text-[color:var(--muted)]">
                    片道の所要時間
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {formatMinutes(journey.estimatedTravelTime)}
                  </p>
                  <p className="mt-2 text-[10px] text-[color:var(--muted)]">
                    {transportLabel(journey.transport, journey.transfer)}での目安
                    {journey.transport === "bicycle" &&
                      `（往復${journey.distanceKm * 2}km${journey.nights ? `・帰りは${journey.nights + 1}日目` : ""}）`}
                  </p>
                </div>
                <div className="rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
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
                    {journey.people}名・
                    {journey.nights ? `${journey.nights}泊${journey.nights + 1}日` : "日帰り"}合計
                    {journey.people > 1 &&
                      `（1名あたり約${formatYen(
                        Math.round(journey.estimatedBudget.total / journey.people),
                      )}）`}
                  </p>
                </div>
              </div>

              <AccessCard
                key={`access-${journey.destination.id}`}
                className="order-4 lg:order-none"
                start={journey.start}
                destination={journey.destination}
              />

              <div className="order-5 rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 lg:order-none">
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
                  {journey.estimatedBudget.lodgingCost ? (
                    <div className="flex items-center justify-between">
                      <dt className="flex items-center gap-2 text-[color:var(--muted)]">
                        <BedDouble size={16} /> 宿泊
                        {journey.lodging &&
                          `（${lodgingInfo[journey.lodging].labelJa}・${journey.nights}泊）`}
                      </dt>
                      <dd className="font-bold">
                        {formatYen(journey.estimatedBudget.lodgingCost)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <p className="mt-4 text-[10px] text-[color:var(--muted)]">
                  費用は距離とカテゴリから算出した目安です。実際の料金を保証するものではありません。
                </p>
              </div>

              <div className="order-6 flex items-start gap-3 rounded-[24px] bg-forest p-5 text-white lg:order-none">
                <TabiMascot mood="excited" size="small" />
                <div className="pt-3">
                  <p className="text-xs font-bold text-white/80">
                    タビのおすすめ理由
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6">
                    {randomItem(reasonTexts)}
                  </p>
                </div>
              </div>

              <PlaceRating
                key={`rating-${journey.destination.id}`}
                className="order-6 lg:order-none"
                placeId={journey.destination.id}
                name={journey.destination.name}
                prefecture={journey.prefecture.nameJa}
              />

              <PlaceReviews
                key={`reviews-${journey.destination.id}`}
                className="order-6 lg:order-none"
                placeId={journey.destination.id}
              />

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
                    className="order-7 w-full lg:order-none"
                  >
                    {savedJourneyId === journey.id
                      ? "保存しました"
                      : "この旅を保存"}
                  </ActionButton>
                ) : (
                  <ActionButton
                    onClick={() => signInWithGoogle().catch(() => {})}
                    icon={<Bookmark size={18} />}
                    className="order-7 w-full lg:order-none"
                  >
                    ログインして保存
                  </ActionButton>
                ))}

              <ActionButton
                variant="ghost"
                onClick={handleShare}
                icon={shareFeedback ? <Check size={18} /> : <Share2 size={18} />}
                className="order-8 w-full lg:order-none"
              >
                {shareFeedback ? "画像を保存＆コピーしました" : "この旅を共有"}
              </ActionButton>

              <ActionButton
                variant="ghost"
                onClick={handleCopyLink}
                icon={linkCopied ? <Check size={18} /> : <Link2 size={18} />}
                className="order-8 w-full lg:order-none"
              >
                {linkCopied ? "リンクをコピーしました" : "共有リンクをコピー"}
              </ActionButton>
            </div>
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
    </>
  );
}
